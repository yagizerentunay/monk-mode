import { describe, expect, it } from 'vitest'
import {
  createWakeLock,
  wakeLockSupported,
  type SentinelLike,
  type WakeLockNavigator,
  type WakeLockState,
} from './useWakeLock.ts'

function fakeSentinel() {
  const listeners: (() => void)[] = []
  const s = {
    releaseCalls: 0,
    release() {
      s.releaseCalls++
      listeners.forEach((l) => l())
      return Promise.resolve()
    },
    addEventListener(_t: 'release', l: () => void) {
      listeners.push(l)
    },
    /** Tarayıcının kendi bıraktığı durum (sekme gizlendi): release() çağrılmadan olay gelir. */
    systemRelease() {
      listeners.forEach((l) => l())
    },
  }
  return s
}

function fakeDoc(visible = true) {
  const listeners = new Set<() => void>()
  return {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.add(l),
    removeEventListener: (_t: 'visibilitychange', l: () => void) => void listeners.delete(l),
    listenerCount: () => listeners.size,
    set(visible: boolean) {
      this.visibilityState = visible ? 'visible' : 'hidden'
      listeners.forEach((l) => l())
    },
  }
}

/** Her `request` çağrısını elle çözülebilir bir söz olarak tutan sahte `navigator.wakeLock`. */
function fakeNav() {
  const calls: { resolve(s: SentinelLike): void; reject(e: unknown): void }[] = []
  const nav: WakeLockNavigator & { calls: typeof calls } = {
    calls,
    wakeLock: {
      request: () =>
        new Promise<SentinelLike>((resolve, reject) => {
          calls.push({ resolve, reject })
        }),
    },
  }
  return nav
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function track() {
  const states: WakeLockState[] = []
  return { states, on: (s: WakeLockState) => void states.push(s), last: () => states[states.length - 1] }
}

describe('ekran kilidi', () => {
  it('API yoksa hiçbir şey yapmaz ve fırlatmaz', () => {
    const doc = fakeDoc()
    const t = track()
    expect(wakeLockSupported({})).toBe(false)
    const lock = createWakeLock({}, doc, t.on)
    expect(t.states).toEqual(['desteklenmiyor'])
    expect(doc.listenerCount()).toBe(0)
    expect(() => lock.dispose()).not.toThrow()
  })

  it('oluşturulunca kilidi ister ve alınca aktif olur', async () => {
    const nav = fakeNav()
    const t = track()
    createWakeLock(nav, fakeDoc(), t.on)
    expect(nav.calls).toHaveLength(1)
    expect(t.last()).toBe('bekliyor')
    nav.calls[0].resolve(fakeSentinel())
    await flush()
    expect(t.last()).toBe('aktif')
  })

  it('dispose kilidi bırakır ve dinleyiciyi kaldırır', async () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    const s = fakeSentinel()
    const t = track()
    const lock = createWakeLock(nav, doc, t.on)
    nav.calls[0].resolve(s)
    await flush()
    lock.dispose()
    expect(s.releaseCalls).toBe(1)
    expect(doc.listenerCount()).toBe(0)
    expect(t.last()).toBe('bekliyor')
  })

  it('sistem kilidi bırakınca bekliyor olur, sayfa görünür olunca yeniden ister', async () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    const t = track()
    createWakeLock(nav, doc, t.on)
    const first = fakeSentinel()
    nav.calls[0].resolve(first)
    await flush()
    doc.set(false)
    first.systemRelease()
    expect(t.last()).toBe('bekliyor')
    // Gizliyken istek açılmaz.
    expect(nav.calls).toHaveLength(1)
    doc.set(true)
    expect(nav.calls).toHaveLength(2)
    nav.calls[1].resolve(fakeSentinel())
    await flush()
    expect(t.last()).toBe('aktif')
  })

  it('kilit tutulurken görünürlük olayı ikinci istek açmaz', async () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    createWakeLock(nav, doc, () => {})
    nav.calls[0].resolve(fakeSentinel())
    await flush()
    doc.set(true)
    expect(nav.calls).toHaveLength(1)
  })

  it('istek yoldayken gelen görünürlük olayları çift istek açmaz', () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    createWakeLock(nav, doc, () => {})
    doc.set(true)
    doc.set(true)
    expect(nav.calls).toHaveLength(1)
  })

  it('sayfa gizliyken başlarsa istemez, görünür olunca ister', () => {
    const nav = fakeNav()
    const doc = fakeDoc(false)
    createWakeLock(nav, doc, () => {})
    expect(nav.calls).toHaveLength(0)
    doc.set(true)
    expect(nav.calls).toHaveLength(1)
  })

  it('reddedilen istek fırlatmaz, bekliyor kalır ve görünürlükte yeniden denenir', async () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    const t = track()
    createWakeLock(nav, doc, t.on)
    nav.calls[0].reject(new DOMException('düşük pil', 'NotAllowedError'))
    await flush()
    expect(t.last()).toBe('bekliyor')
    doc.set(true)
    expect(nav.calls).toHaveLength(2)
    nav.calls[1].resolve(fakeSentinel())
    await flush()
    expect(t.last()).toBe('aktif')
  })

  it('sentinel.release reddedilse de dispose fırlatmaz', async () => {
    const nav = fakeNav()
    const s = fakeSentinel()
    s.release = () => {
      s.releaseCalls++
      return Promise.reject(new Error('zaten bırakılmış'))
    }
    const lock = createWakeLock(nav, fakeDoc(), () => {})
    nav.calls[0].resolve(s)
    await flush()
    expect(() => lock.dispose()).not.toThrow()
    await flush()
    expect(s.releaseCalls).toBe(1)
  })

  it('dispose sonrası gelen sentinel hemen bırakılır ve aktif olunmaz', async () => {
    const nav = fakeNav()
    const t = track()
    const lock = createWakeLock(nav, fakeDoc(), t.on)
    lock.dispose()
    const late = fakeSentinel()
    nav.calls[0].resolve(late)
    await flush()
    expect(late.releaseCalls).toBe(1)
    expect(t.states).not.toContain('aktif')
  })

  it('dispose sonrası görünürlük olayı yeni istek açmaz', () => {
    const nav = fakeNav()
    const doc = fakeDoc()
    const lock = createWakeLock(nav, doc, () => {})
    lock.dispose()
    doc.set(true)
    expect(nav.calls).toHaveLength(1)
  })
})
