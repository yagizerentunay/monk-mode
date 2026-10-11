import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { weekComparison, weeklyTotals } from './weeklyTrend.ts'

// 15 Ekim 2026 Perşembe; hafta Pazartesi başlar (weekStart = 1).
const TODAY = new Date(2026, 9, 15)

const wk = (d: string, sets: { w: number; r: number; done?: boolean; warmup?: boolean; drop?: boolean }[]): Workout => ({
  id: d + Math.random(),
  d,
  start: 1,
  name: 'A',
  entries: [{ exId: 'bench', sets: sets.map((s) => ({ done: true, ...s })) }],
})

describe('haftalık toplamlar', () => {
  it('12 hafta döner, eskiden yeniye; son hafta içinde bulunulan hafta', () => {
    const t = weeklyTotals([], TODAY, 1)
    expect(t).toHaveLength(12)
    expect(t[11].start).toBe('2026-10-12')
    expect(t[0].start).toBe('2026-07-27')
    expect(t.every((w) => w.sets === 0 && w.workouts === 0)).toBe(true)
  })

  it('antrenmanları haftasına koyar; ısınma ve dropset set sayısına girmez', () => {
    const t = weeklyTotals(
      [
        wk('2026-10-12', [{ w: 40, r: 8, warmup: true }, { w: 60, r: 5 }, { w: 60, r: 5 }, { w: 48, r: 5, drop: true }]),
        wk('2026-10-14', [{ w: 60, r: 5 }]),
        wk('2026-10-11', [{ w: 60, r: 5 }]), // Pazar: önceki hafta
        wk('2026-01-01', [{ w: 60, r: 5 }]), // pencere dışı
      ],
      TODAY,
      1,
    )
    expect(t[11]).toMatchObject({ sets: 3, workouts: 2, volume: 60 * 5 * 3 + 48 * 5 })
    expect(t[10]).toMatchObject({ sets: 1, workouts: 1 })
    expect(t.reduce((s, w) => s + w.workouts, 0)).toBe(3)
  })

  it('hafta başlangıcı ayarına uyar (Pazar)', () => {
    const t = weeklyTotals([wk('2026-10-11', [{ w: 60, r: 5 }])], TODAY, 0)
    expect(t[11].start).toBe('2026-10-11')
    expect(t[11].workouts).toBe(1)
  })

  it('karşılaştırma: bu hafta ve antrenmanlı önceki en çok 4 haftanın ortalaması', () => {
    const t = weeklyTotals(
      [wk('2026-10-13', [{ w: 1, r: 1 }]), wk('2026-10-06', [{ w: 1, r: 1 }, { w: 1, r: 1 }]), wk('2026-09-22', [{ w: 1, r: 1 }, { w: 1, r: 1 }, { w: 1, r: 1 }, { w: 1, r: 1 }])],
      TODAY,
      1,
    )
    expect(weekComparison(t, 'sets')).toEqual({ current: 1, average: 3 })
    expect(weekComparison(weeklyTotals([], TODAY, 1), 'sets')).toEqual({ current: 0, average: null })
  })
})
