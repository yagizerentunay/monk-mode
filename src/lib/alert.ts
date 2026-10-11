/**
 * Dinlenme bitince kısa bip ve titreşim; tarayıcı izin vermezse sessizce atlanır.
 *
 * iOS Safari/PWA'da jest dışında oluşturulan veya resume edilen AudioContext
 * 'suspended' kalır ve bip sessiz çıkar. Bu yüzden tek bir paylaşılan context
 * tutulur ve ilk kullanıcı dokunuşlarında "kilidi açılır" (installAudioUnlock).
 */

type AudioCtor = typeof AudioContext

let sharedCtx: AudioContext | null = null
let primed = false
let unlockInstalled = false

function getContext(): AudioContext | null {
  try {
    if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx
    const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
    const Ctor = g.AudioContext ?? g.webkitAudioContext
    if (!Ctor) return null
    // Safari 16.4+: 'ambient' bip sesini çalan müzikle karıştırır; varsayılan oturum müziği duraklatabilir.
    const nav = globalThis.navigator as (Navigator & { audioSession?: { type: string } }) | undefined
    if (nav?.audioSession) nav.audioSession.type = 'ambient'
    sharedCtx = new Ctor()
    primed = false
    return sharedCtx
  } catch {
    return null
  }
}

/** resume() hata verse de dışarı sızmaz; iOS'ta 'interrupted' durumu da burada yakalanır. */
function resumeIfNeeded(ctx: AudioContext): Promise<void> {
  if ((ctx.state as string) === 'running') return Promise.resolve()
  try {
    return Promise.resolve(ctx.resume()).catch(() => undefined)
  } catch {
    return Promise.resolve()
  }
}

/** iOS kilidini açan bilinen hile: ilk jestte 1 örneklik sessiz tampon çal. */
function playSilentBuffer(ctx: AudioContext): void {
  try {
    const src = ctx.createBufferSource()
    src.buffer = ctx.createBuffer(1, 1, 22050)
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // sessiz tampon çalınamadı
  }
}

function unlock(): void {
  const ctx = getContext()
  if (!ctx) return
  void resumeIfNeeded(ctx)
  if (!primed) {
    primed = true
    playSilentBuffer(ctx)
  }
}

/**
 * Kullanıcı jestlerinde paylaşılan AudioContext'i oluşturup resume eder.
 * Birden çok kez çağrılması güvenlidir; tarayıcı dışında hiçbir şey yapmaz.
 * Dinleyiciler kalıcıdır: arka plana gidip dönünce de context 'interrupted' olabilir.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof document === 'undefined') return
  unlockInstalled = true
  for (const type of ['pointerdown', 'touchend', 'keydown']) {
    document.addEventListener(type, unlock, { passive: true, capture: true })
  }
}

function playBeep(ctx: AudioContext): void {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    // Paylaşılan context kapatılmaz; yalnız düğümler bırakılır.
    osc.onended = () => {
      try {
        osc.disconnect()
        gain.disconnect()
      } catch {
        // zaten ayrılmış
      }
    }
  } catch {
    // ses desteklenmiyor
  }
}

/** Tanılama için ses bağlamının durumu; henüz oluşturulmadıysa (hiç dokunulmadı) 'none'. */
export function audioState(): string {
  return sharedCtx ? sharedCtx.state : 'none'
}

export function restDoneAlert(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // titreşim desteklenmiyor
  }
  const ctx = getContext()
  if (!ctx) return
  void resumeIfNeeded(ctx).then(() => playBeep(ctx))
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = String(s % 60).padStart(2, '0')
  return `${m}:${r}`
}
