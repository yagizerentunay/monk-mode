import { beforeEach, describe, expect, it } from 'vitest'
import { CORRUPT_PREFIX, dismissCorrupt, dismissSanitized, loadState, saveState, STORAGE_KEY, useStorageStatus } from './persist.ts'
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
  useStorageStatus.setState({ saveFailed: false, corrupt: null, sanitized: null, blocked: false })
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

describe('bozuk kayıtların karantinası', () => {
  const GOOD = { id: 'ok', d: '2026-10-02', start: 2, name: 'Sağlam', entries: [{ exId: 'bench', sets: [{ w: 50, r: 5, done: true }] }] }
  const BROKEN = { id: 'x', d: '2026-10-01', start: 1, name: 'Bozuk' }
  const raw = JSON.stringify({ ...defaultState(), workouts: [BROKEN, GOOD] })

  it('bozuk kaydı atar, sağlamı yükler, ham metni aynen yan kopyaya alır ve uyarır', () => {
    const s = fakeStorage({ [STORAGE_KEY]: raw })
    const state = loadState(s, NOW)
    expect(state.workouts.map((w) => w.id)).toEqual(['ok'])

    const key = `${CORRUPT_PREFIX}${NOW.toISOString()}`
    expect(s.data.get(key)).toBe(raw)
    expect(s.data.get(STORAGE_KEY)).toBe(raw) // yükleme ana anahtara dokunmaz
    expect(useStorageStatus.getState().sanitized).toEqual({ dropped: 1, repaired: 0, raw, key })
    expect(useStorageStatus.getState().corrupt).toBeNull()
    expect(useStorageStatus.getState().blocked).toBe(false)

    saveState(s, state) // temizlenmiş veri güvenle yazılır; kopya kalır
    expect(s.data.get(key)).toBe(raw)
    expect(JSON.parse(s.data.get(STORAGE_KEY) ?? '').workouts).toHaveLength(1)
  })

  it('yeniden açılışta kopya çoğalmaz; uyarıyı kapatmak kopyayı silmez', () => {
    const s = fakeStorage({ [STORAGE_KEY]: raw })
    loadState(s, NOW)
    loadState(s, new Date(NOW.getTime() + 1000))
    expect(corruptKeys(s)).toHaveLength(1)
    dismissSanitized()
    expect(useStorageStatus.getState().sanitized).toBeNull()
    expect(corruptKeys(s)).toHaveLength(1)
  })

  it('kopya yazılamazsa onaylanana dek ana anahtarın üstüne yazmaz', () => {
    const s = fakeStorage({ [STORAGE_KEY]: raw })
    s.full = true
    const state = loadState(s, NOW)
    expect(state.workouts).toHaveLength(1)
    expect(useStorageStatus.getState().blocked).toBe(true)
    expect(useStorageStatus.getState().sanitized?.key).toBeNull()

    s.full = false
    saveState(s, state)
    expect(s.data.get(STORAGE_KEY)).toBe(raw)
    dismissSanitized()
    saveState(s, state)
    expect(JSON.parse(s.data.get(STORAGE_KEY) ?? '').workouts).toHaveLength(1)
  })

  it('yalnız onarım gerekiyorsa karantina ve uyarı olmaz', () => {
    const s = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ ...defaultState(), workouts: [{ ...GOOD, note: 5 }] }) })
    loadState(s, NOW)
    expect(corruptKeys(s)).toEqual([])
    expect(useStorageStatus.getState().sanitized).toBeNull()
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
