import { describe, expect, it } from 'vitest'
import { loadRest, REST_KEY, saveRest } from './restState.ts'

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

const NOW = 1_000_000

describe('dinlenme sayacı kalıcılığı', () => {
  it('kaydedilen bitiş zamanını aynı antrenman için geri verir', () => {
    const store = memory()
    saveRest('w1', NOW + 60_000, store)
    expect(loadRest('w1', NOW, store)).toBe(NOW + 60_000)
  })

  it('başka antrenmanın sayacını vermez', () => {
    const store = memory()
    saveRest('w1', NOW + 60_000, store)
    expect(loadRest('w2', NOW, store)).toBeNull()
  })

  it('süresi dolmuş sayacı vermez (bip yenilenince tekrar çalmasın)', () => {
    const store = memory()
    saveRest('w1', NOW - 1, store)
    expect(loadRest('w1', NOW, store)).toBeNull()
    saveRest('w1', NOW, store)
    expect(loadRest('w1', NOW, store)).toBeNull()
  })

  it('null kaydı sayacı siler', () => {
    const store = memory()
    saveRest('w1', NOW + 60_000, store)
    saveRest('w1', null, store)
    expect(store.data.has(REST_KEY)).toBe(false)
    expect(loadRest('w1', NOW, store)).toBeNull()
  })

  it('bozuk ya da eksik kayıtta çökmez', () => {
    expect(loadRest('w1', NOW, memory())).toBeNull()
    expect(loadRest('w1', NOW, memory({ [REST_KEY]: '{bozuk' }))).toBeNull()
    expect(loadRest('w1', NOW, memory({ [REST_KEY]: JSON.stringify({ id: 'w1', endsAt: 'yarın' }) }))).toBeNull()
    expect(loadRest('w1', NOW, memory({ [REST_KEY]: JSON.stringify({ id: 'w1', endsAt: null }) }))).toBeNull()
  })

  it('depolama yoksa ya da yazma hata verirse sessiz kalır', () => {
    expect(() => saveRest('w1', NOW + 1000, null)).not.toThrow()
    expect(loadRest('w1', NOW, null)).toBeNull()
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('engelli')
      },
    }
    expect(() => saveRest('w1', NOW + 1000, full)).not.toThrow()
    expect(() => saveRest('w1', null, full)).not.toThrow()
  })
})
