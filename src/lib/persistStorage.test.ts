import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Mock = { persisted?: unknown; persist?: unknown } | undefined

/** navigator.storage'ı taklit eder; her testte modülü sıfırdan yükler (oturum bayrağı temiz kalsın). */
async function load(storage: Mock) {
  vi.resetModules()
  vi.stubGlobal('navigator', { storage })
  return import('./persistStorage.ts')
}

describe('persistStorage', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('persisted() true ise "persisted" döner', async () => {
    const m = await load({ persisted: async () => true, persist: async () => true })
    expect(await m.getPersistStatus()).toBe('persisted')
  })

  it('persisted() false ise "not-persisted" döner', async () => {
    const m = await load({ persisted: async () => false, persist: async () => true })
    expect(await m.getPersistStatus()).toBe('not-persisted')
  })

  it('API yoksa "unsupported" döner', async () => {
    for (const storage of [undefined, {}, { persisted: async () => true }]) {
      const m = await load(storage)
      expect(await m.getPersistStatus()).toBe('unsupported')
    }
    expect(await (await load(undefined)).requestPersist()).toBe('unsupported')
  })

  it('persisted() hata fırlatırsa "unsupported" döner', async () => {
    const m = await load({
      persisted: async () => {
        throw new Error('boom')
      },
      persist: async () => true,
    })
    expect(await m.getPersistStatus()).toBe('unsupported')
  })

  it('requestPersist izin verilirse "persisted", reddedilirse "not-persisted" döner', async () => {
    expect(await (await load({ persist: async () => true })).requestPersist()).toBe('persisted')
    expect(await (await load({ persist: async () => false })).requestPersist()).toBe('not-persisted')
  })

  it('persist() hata fırlatırsa "not-persisted" döner', async () => {
    const m = await load({ persist: () => Promise.reject(new Error('boom')) })
    expect(await m.requestPersist()).toBe('not-persisted')
  })

  it('requestPersistOnce oturumda yalnız bir kez persist() çağırır', async () => {
    const persist = vi.fn(async () => true)
    const m = await load({ persisted: async () => true, persist })
    expect(await m.requestPersistOnce()).toBe('persisted')
    expect(await m.requestPersistOnce()).toBe('persisted')
    expect(persist).toHaveBeenCalledTimes(1)
  })
})
