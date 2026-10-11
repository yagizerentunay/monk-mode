import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import { deloadSnoozeUntil, detectDeload, isDeloadSnoozed } from './deload.ts'

const DAY = 24 * 60 * 60 * 1000
/** Sabit "şimdi": 2026-10-11 öğle. */
const NOW = new Date(2026, 9, 11, 12).getTime()

function dayOffset(daysAgo: number): string {
  const d = new Date(NOW - daysAgo * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Plan = Record<string, SetEntry[] | number>

/**
 * Seans listesi, eski→yeni: her eleman o seansın `exId → ağırlık` (5 tekrarlık tek set) ya da ham set listesi.
 * Seanslar `step` gün arayla biter; sonuncusu `lastAgo` gün önce.
 */
function sessions(plans: Plan[], lastAgo = 2, step = 3): Workout[] {
  return plans.map((plan, i) => ({
    id: String(i),
    d: dayOffset(lastAgo + (plans.length - 1 - i) * step),
    start: 0,
    name: 'A',
    entries: Object.entries(plan).map(([exId, v]) => ({
      exId,
      sets: typeof v === 'number' ? [{ w: v, r: 5, done: true }] : v,
    })),
  }))
}

/** İki egzersiz: 4 normal seans, sonra iki düşük seans. */
function declining(ex: string[], drop = 0.9): Plan[] {
  const mk = (w: number): Plan => Object.fromEntries(ex.map((id) => [id, w]))
  return [mk(100), mk(100), mk(100), mk(100), mk(100 * drop), mk(100 * drop)]
}

describe('detectDeload', () => {
  it('geçmiş yoksa ya da çok azsa öneri yok', () => {
    expect(detectDeload([], NOW)).toBeUndefined()
    // 3 seans: son ikisi düşük ama karşılaştırılacak tek seans var.
    const wk = sessions([{ a: 100, b: 100 }, { a: 90, b: 90 }, { a: 90, b: 90 }])
    expect(detectDeload(wk, NOW)).toBeUndefined()
  })

  it('tek egzersizdeki düşüş yetmez', () => {
    const wk = sessions(declining(['a']))
    expect(detectDeload(wk, NOW)).toBeUndefined()
    // Diğer egzersiz düşmüyorsa da yetmez.
    const mixed = sessions(declining(['a']).map((p) => ({ ...p, b: 80 })))
    expect(detectDeload(mixed, NOW)).toBeUndefined()
  })

  it('iki egzersiz art arda iki seans belirgin düşerse önerir', () => {
    const wk = sessions(declining(['a', 'b']))
    expect(detectDeload(wk, NOW)?.exercises.sort()).toEqual(['a', 'b'])
  })

  it('yalnız son seans düşükse yetmez (art arda iki seans gerekir)', () => {
    const plans = declining(['a', 'b'])
    plans[4] = { a: 100, b: 100 }
    expect(detectDeload(sessions(plans), NOW)).toBeUndefined()
  })

  it('küçük (%5 altı) gerileme düşüş sayılmaz, tam %5 sayılır', () => {
    expect(detectDeload(sessions(declining(['a', 'b'], 0.97)), NOW)).toBeUndefined()
    expect(detectDeload(sessions(declining(['a', 'b'], 0.95)), NOW)).toBeDefined()
  })

  it('eski geçmiş (son seans 2 haftadan eski) yok sayılır', () => {
    expect(detectDeload(sessions(declining(['a', 'b']), 20), NOW)).toBeUndefined()
    expect(detectDeload(sessions(declining(['a', 'b']), 13), NOW)).toBeDefined()
  })

  it('uzun aradan sonraki dönüş düşüş sayılmaz', () => {
    // Karşılaştırma seansları son seanstan 90 günden uzak.
    const plans = declining(['a', 'b'])
    const wk = sessions(plans, 2, 3)
    wk.slice(0, 4).forEach((w, i) => (w.d = dayOffset(200 + i)))
    expect(detectDeload(wk, NOW)).toBeUndefined()
  })

  it('ısınma, dropset ve tamamlanmamış setler yok sayılır', () => {
    const noise: SetEntry[] = [
      { w: 200, r: 5, done: true, warmup: true },
      { w: 150, r: 20, done: true, drop: true },
      { w: 300, r: 5, done: false },
    ]
    const plans = declining(['a', 'b']).map((p, i) =>
      i >= 4 ? { a: [{ w: 90, r: 5, done: true }, ...noise], b: [{ w: 90, r: 5, done: true }, ...noise] } : p,
    )
    // Gürültü sayılsaydı son iki seans "yüksek" görünür ve öneri çıkmazdı.
    expect(detectDeload(sessions(plans), NOW)?.exercises).toHaveLength(2)
  })

  it('vücut ağırlığı egzersizinde etkin yük kullanılır', () => {
    // Ek yük +10 → +10 sabit görünür; ama vücut ağırlığı 80 → 75 kg düşünce etkin yük 90 → 85 kg (%94) olur.
    const bwSets = (bwKg: number, w: number) => ({
      exId: 'pull',
      bw: true,
      bwKg,
      sets: [{ w, r: 5, done: true }],
    })
    const mk = (bwKg: number, w: number): Workout[] =>
      [0, 1, 2, 3, 4, 5].map((i) => ({
        id: `p${i}`,
        d: dayOffset(2 + (5 - i) * 3),
        start: 0,
        name: 'A',
        entries: [
          bwSets(i < 4 ? 80 : bwKg, i < 4 ? 10 : w),
          { exId: 'row', sets: [{ w: i < 4 ? 100 : 90, r: 5, done: true }] },
        ],
      }))
    // Ek yük aynı (10), vücut ağırlığı 80 → 70: etkin 90 → 80 (%89) düşüş.
    expect(detectDeload(mk(70, 10), NOW)?.exercises.sort()).toEqual(['pull', 'row'])
    // Ham `w` ile bakılsaydı pull düşmemiş görünürdü; vücut ağırlığı aynı kalırsa gerçekten düşmemiştir.
    expect(detectDeload(mk(80, 10), NOW)).toBeUndefined()
  })

  it('son iki seansı bilinçli hafif (RIR >= 4) olan egzersiz düşüşte sayılmaz', () => {
    const easy = (w: number): SetEntry[] => [{ w, r: 5, done: true, rir: 4 }]
    const plans = declining(['a', 'b']).map((p, i) => (i >= 4 ? { a: easy(90), b: easy(90) } : p))
    expect(detectDeload(sessions(plans), NOW)).toBeUndefined()
    // Biri kalırsa tek egzersiz yetmez; ikisi de hafif değilse öneri sürer.
    const oneEasy = declining(['a', 'b']).map((p, i) => (i >= 4 ? { a: easy(90), b: 90 } : p))
    expect(detectDeload(sessions(oneEasy), NOW)).toBeUndefined()
  })
})

describe('susturma', () => {
  it('susturma süresi dolana kadar gizler', () => {
    expect(isDeloadSnoozed(undefined, NOW)).toBe(false)
    expect(isDeloadSnoozed(NOW + 1, NOW)).toBe(true)
    expect(isDeloadSnoozed(NOW, NOW)).toBe(false)
  })

  it('"Şimdi değil" 7 gün susturur', () => {
    expect(deloadSnoozeUntil(NOW)).toBe(NOW + 7 * DAY)
  })
})
