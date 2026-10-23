// ~1 yıllık örnek yedek üretir (scripts/demo-data.ts, WEEKS ortam değişkeniyle). NOISY=1: ağırlık, tekrar,
// RIR, saat ve notlara deterministik gürültü; gerçek veri kadar düzensiz, sıkıştırma için kötümser sınır.
import { writeFileSync } from 'node:fs'
import { demoState } from './demo-year.ts'

let seed = 42
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const notes = ['Sol omuz hafif ağrıdı', 'Uykusuzdum, tempo düşük', 'Yeni rekor!', 'Bar yavaş kalktı', 'Salon kalabalıktı']
const state = demoState() as { workouts: { start: number; end: number; note?: string; entries: { sets: { w: number; r: number; rir?: number }[] }[] }[] }
if (process.env.NOISY) {
  for (const w of state.workouts) {
    w.start += Math.floor(rnd() * 3_600_000)
    w.end = w.start + Math.floor((45 + rnd() * 50) * 60_000)
    if (rnd() < 0.3) w.note = notes[Math.floor(rnd() * notes.length)]
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (s.w) s.w = Math.round((s.w + (rnd() - 0.5) * 5) * 4) / 4
        s.r = Math.max(1, s.r + Math.floor((rnd() - 0.5) * 4))
        if (rnd() < 0.4) s.rir = Math.floor(rnd() * 4)
      }
    }
  }
}
// Uygulamanın exportBackup biçimi: { app, exportedAt, state }, 2 boşluk girinti.
writeFileSync(process.argv[2], JSON.stringify({ app: 'monk-mode', exportedAt: '2026-10-23T09:00:00.000Z', state }, null, 2))
