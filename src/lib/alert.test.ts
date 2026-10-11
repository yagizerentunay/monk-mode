import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatClock } from './alert.ts'

describe('formatClock', () => {
  it('saniyeyi dakika:saniye yazar', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(3600)).toBe('60:00')
  })

  it('negatif değeri sıfıra çeker', () => {
    expect(formatClock(-4)).toBe('0:00')
  })
})

describe('restDoneAlert / installAudioUnlock', () => {
  type Handler = () => void
  let instances: FakeCtx[]
  let listeners: Record<string, Handler>
  let vibrate: ReturnType<typeof vi.fn>

  class FakeCtx {
    state = 'suspended'
    currentTime = 0
    destination = {}
    resume = vi.fn(() => {
      this.state = 'running'
      return Promise.resolve()
    })
    close = vi.fn()
    constructor() {
      instances.push(this)
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect: (n: unknown) => n,
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      }
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: (n: unknown) => n,
        disconnect() {},
      }
    }
    createBuffer() {
      return {}
    }
    createBufferSource() {
      return { connect() {}, start() {} }
    }
  }

  async function load() {
    vi.resetModules()
    return import('./alert.ts')
  }

  beforeEach(() => {
    instances = []
    listeners = {}
    vibrate = vi.fn()
    vi.stubGlobal('AudioContext', FakeCtx)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('document', {
      addEventListener: (type: string, fn: Handler) => {
        listeners[type] = fn
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('birden çok bipte tek context kullanır ve kapatmaz', async () => {
    const { restDoneAlert } = await load()
    restDoneAlert()
    restDoneAlert()
    await Promise.resolve()
    expect(instances).toHaveLength(1)
    expect(instances[0].close).not.toHaveBeenCalled()
  })

  it('askıdaki context bip öncesi resume edilir', async () => {
    const { restDoneAlert } = await load()
    restDoneAlert()
    expect(instances[0].resume).toHaveBeenCalled()
  })

  it("jest dinleyicisi askıdaki context'i resume eder", async () => {
    const { installAudioUnlock } = await load()
    installAudioUnlock()
    installAudioUnlock()
    expect(Object.keys(listeners).sort()).toEqual(['keydown', 'pointerdown', 'touchend'])
    listeners.pointerdown()
    expect(instances).toHaveLength(1)
    expect(instances[0].resume).toHaveBeenCalledTimes(1)
    expect(instances[0].state).toBe('running')
  })

  it('interrupted durumundaki context de resume edilir', async () => {
    const { installAudioUnlock } = await load()
    installAudioUnlock()
    listeners.touchend()
    instances[0].state = 'interrupted'
    listeners.touchend()
    expect(instances[0].resume).toHaveBeenCalledTimes(2)
  })

  it('AudioContext yoksa fırlatmaz ve titreşir', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { restDoneAlert } = await load()
    expect(() => restDoneAlert()).not.toThrow()
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200])
  })

  it('AudioContext kurucusu fırlatırsa dışarı sızmaz', async () => {
    vi.stubGlobal(
      'AudioContext',
      function Boom() {
        throw new Error('boom')
      },
    )
    const { restDoneAlert, installAudioUnlock } = await load()
    installAudioUnlock()
    expect(() => listeners.pointerdown()).not.toThrow()
    expect(() => restDoneAlert()).not.toThrow()
    expect(vibrate).toHaveBeenCalled()
  })

  it('resume reddedilirse fırlatmaz', async () => {
    vi.stubGlobal(
      'AudioContext',
      class extends FakeCtx {
        resume = vi.fn(() => Promise.reject(new Error('jest yok')))
      },
    )
    const { restDoneAlert } = await load()
    expect(() => restDoneAlert()).not.toThrow()
    await Promise.resolve()
  })

  it('tarayıcı dışında (document yok) kurulum sessizce atlanır', async () => {
    vi.stubGlobal('document', undefined)
    const { installAudioUnlock } = await load()
    expect(() => installAudioUnlock()).not.toThrow()
  })
})
