import { describe, expect, it } from 'vitest'
import { createSaveScheduler } from './saveScheduler.ts'

/** Elle ilerletilen sahte saat ve zamanlayıcı. */
function clock() {
  let t = 1_000
  let pending: { at: number; fn: () => void } | null = null
  return {
    deps: {
      now: () => t,
      setTimer: (fn: () => void, ms: number) => (pending = { at: t + ms, fn }),
      clearTimer: () => {
        pending = null
      },
    },
    advance(ms: number) {
      t += ms
      if (pending && pending.at <= t) {
        const p = pending
        pending = null
        p.fn()
      }
    },
    get pending() {
      return pending !== null
    },
  }
}

describe('kayıt kısıcı', () => {
  it('sakin anda ilk değişikliği hemen yazar', () => {
    const c = clock()
    let writes = 0
    const s = createSaveScheduler(() => writes++, 500, c.deps)
    s.notify()
    expect(writes).toBe(1)
    expect(c.pending).toBe(false)
  })

  it('arka arkaya gelenleri biriktirip süre dolunca tek kez yazar', () => {
    const c = clock()
    let writes = 0
    const s = createSaveScheduler(() => writes++, 500, c.deps)
    s.notify() // hemen
    for (let i = 0; i < 10; i++) {
      c.advance(20)
      s.notify()
    }
    expect(writes).toBe(1)
    c.advance(500)
    expect(writes).toBe(2)
  })

  it('flush bekleyen kaydı hemen yazar; bekleyen yoksa bir şey yapmaz', () => {
    const c = clock()
    let writes = 0
    const s = createSaveScheduler(() => writes++, 500, c.deps)
    s.flush()
    expect(writes).toBe(0)
    s.notify()
    c.advance(10)
    s.notify()
    expect(writes).toBe(1)
    s.flush()
    expect(writes).toBe(2)
    expect(c.pending).toBe(false)
  })

  it('süre geçtikten sonraki değişiklik yine hemen yazılır', () => {
    const c = clock()
    let writes = 0
    const s = createSaveScheduler(() => writes++, 500, c.deps)
    s.notify()
    c.advance(600)
    s.notify()
    expect(writes).toBe(2)
  })
})
