import { beforeEach, describe, expect, it } from 'vitest'
import { CORRUPT_PREFIX, dismissCorrupt, loadState, saveState, STORAGE_KEY, useStorageStatus } from './persist.ts'
import { defaultState } from './schema.ts'

/** Bellekte çalışan sahte localStorage; `full` iken (kota dolu) setItem fırlatır. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const api = {
    full: false,
    data,
    get length() {
      return data.size
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (api.full) throw new DOMException('kota dolu', 'QuotaExceededError')
      data.set(k, v)
    },
  }
  return api
}

const corruptKeys = (s: ReturnType<typeof fakeStorage>) => [...s.data.keys()].filter((k) => k.startsWith(CORRUPT_PREFIX))
const NOW = new Date('2026-10-11T10:00:00.000Z')

beforeEach(() => {
  useStorageStatus.setState({ saveFailed: false, corrupt: null, blocked: false })
})

describe('bozuk veri karantinası', () => {
  it('bozuk JSON yan anahtara aynen kopyalanır ve sonraki kayıt öncesinde korunur', () => {
    const s = fakeStorage({ [STORAGE_KEY]: '{"workouts": [bozuk' })
    expect(loadState(s, NOW)).toEqual(defaultState())

    const key = `${CORRUPT_PREFIX}${NOW.toISOString()}`
    expect(s.data.get(key)).toBe('{"workouts": [bozuk')
    expect(useStorageStatus.getState().corrupt).toEqual({ raw: '{"workouts": [bozuk', key })
    expect(useStorageStatus.getState().blocked).toBe(false)

    saveState(s, defaultState()) // ana anahtarın üstüne yazmak artık güvenli
    expect(s.data.get(STORAGE_KEY)).toBe(JSON.stringify(defaultState()))
    expect(s.data.get(key)).toBe('{"workouts": [bozuk')
  })

  it('migrate hata fırlatırsa aynı şekilde karantinaya alır', () => {
    const raw = JSON.stringify({ version: 1 })
    const s = fakeStorage({ [STORAGE_KEY]: raw })
    const boom = () => {
      throw new Error('migrate patladı')
    }
    expect(loadState(s, NOW, boom)).toEqual(defaultState())
    expect(corruptKeys(s).map((k) => s.data.get(k))).toEqual([raw])
    expect(useStorageStatus.getState().corrupt?.raw).toBe(raw)
  })

  it('geçerli veri ve boş depoda karantina oluşmaz', () => {
    const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify(defaultState()) })
    loadState(s, NOW)
    loadState(fakeStorage(), NOW)
    expect(corruptKeys(s)).toEqual([])
    expect(useStorageStatus.getState().corrupt).toBeNull()
  })

  it('aynı bozuk veri yeniden açılışta ikinci kopya üretmez', () => {
    const s = fakeStorage({ [STORAGE_KEY]: 'bozuk' })
    loadState(s, NOW)
    loadState(s, new Date(NOW.getTime() + 1000))
    expect(corruptKeys(s)).toHaveLength(1)
  })

  it('kopya yazılamazsa onaylanana dek ana anahtarın üstüne yazmaz', () => {
    const s = fakeStorage({ [STORAGE_KEY]: 'bozuk' })
    s.full = true
    loadState(s, NOW)
    expect(useStorageStatus.getState().blocked).toBe(true)
    expect(useStorageStatus.getState().corrupt).toEqual({ raw: 'bozuk', key: null })

    s.full = false
    saveState(s, defaultState())
    expect(s.data.get(STORAGE_KEY)).toBe('bozuk')

    dismissCorrupt() // kullanıcı onayladı
    saveState(s, defaultState())
    expect(s.data.get(STORAGE_KEY)).toBe(JSON.stringify(defaultState()))
  })

  it('uyarıyı kapatmak yan kopyayı silmez', () => {
    const s = fakeStorage({ [STORAGE_KEY]: 'bozuk' })
    loadState(s, NOW)
    dismissCorrupt()
    expect(useStorageStatus.getState().corrupt).toBeNull()
    expect(corruptKeys(s)).toHaveLength(1)
  })
})

describe('kayıt hatası durumu', () => {
  it('kayıt başarısız olunca işaretlenir, sonraki başarılı kayıtla temizlenir', () => {
    const s = fakeStorage()
    s.full = true
    saveState(s, defaultState())
    expect(useStorageStatus.getState().saveFailed).toBe(true)
    expect(s.data.has(STORAGE_KEY)).toBe(false)

    s.full = false
    saveState(s, defaultState())
    expect(useStorageStatus.getState().saveFailed).toBe(false)
    expect(s.data.get(STORAGE_KEY)).toBe(JSON.stringify(defaultState()))
  })

  it('başarılı kayıt durumu işaretlemez', () => {
    saveState(fakeStorage(), defaultState())
    expect(useStorageStatus.getState().saveFailed).toBe(false)
  })
})
