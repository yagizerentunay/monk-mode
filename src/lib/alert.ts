/** Dinlenme bitince kısa bip ve titreşim; tarayıcı izin vermezse sessizce atlanır. */
export function restDoneAlert(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // titreşim desteklenmiyor
  }
  try {
    const Ctx = window.AudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => void ctx.close()
  } catch {
    // ses desteklenmiyor
  }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = String(s % 60).padStart(2, '0')
  return `${m}:${r}`
}
