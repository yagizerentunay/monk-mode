import { describe, expect, it } from 'vitest'
import type { StrengthGoal, Workout } from '../store/schema.ts'
import {
  addDays,
  dayDiff,
  describeForecast,
  forecastGoal,
  goalHistory,
  newlyReached,
  reachedOn,
  slope,
} from './goals.ts'

const TODAY = '2026-10-24'
const NOW = new Date(2026, 9, 24)

/** `ago` gün önce, tek setli bench seansı (Epley: w × (1 + r/30)). */
const wk = (ago: number, w: number, r = 1, over: Partial<Workout['entries'][number]> = {}): Workout => ({
  id: `w${ago}-${w}-${r}`,
  d: addDays(TODAY, -ago),
  start: 1,
  name: 'A',
  entries: [{ exId: 'bench', sets: [{ w, r, done: true }], ...over }],
})

const goal = (over: Partial<StrengthGoal> = {}): StrengthGoal => ({
  id: 'g1',
  exId: 'bench',
  target: 100,
  by: '2026-12-01',
  created: '2026-08-01',
  ...over,
})

/** Son 8 haftada her hafta +1 kg: 56 gün önce 80, bugün 88. */
const steady = (): Workout[] => [56, 49, 42, 35, 28, 21, 14, 7, 0].map((ago, i) => wk(ago, 80 + i))

describe('gün yardımcıları', () => {
  it('ay ve yıl sınırını aşar', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(dayDiff('2026-02-27', '2026-03-01')).toBe(2)
    expect(dayDiff('2026-03-01', '2026-02-27')).toBe(-2)
  })

  it('en küçük kareler eğimi', () => {
    expect(slope([0, 1, 2, 3], [1, 3, 5, 7])).toBe(2)
    expect(slope([5, 5], [1, 2])).toBe(0)
  })
})

describe('goalHistory', () => {
  it('süreli seansları ve 1RM\'siz seansları almaz', () => {
    const ws = [wk(10, 60, 5), wk(5, 0, 30, { timed: true }), wk(0, 0, 10)]
    expect(goalHistory(ws, 'bench')).toEqual([{ d: addDays(TODAY, -10), e1rm: 70 }])
  })
})

describe('forecastGoal: eğim ve tahmini tarih', () => {
  it('haftada 1 kg artışla 100 kg hedefe 12 hafta kalır', () => {
    const f = forecastGoal(goal({ by: '2027-01-16' }), steady(), TODAY)
    expect(f.kind).toBe('eta')
    if (f.kind !== 'eta') return
    expect(f.current).toBe(88)
    expect(f.perWeek).toBeCloseTo(1, 6)
    expect(f.eta).toBe(addDays(TODAY, 84))
    expect(f.status).toBe('onTime')
  })

  it('tahmini tarih hedef tarihten bir haftadan fazla erkense "önde", geçse "geride"', () => {
    const ahead = forecastGoal(goal({ by: '2027-06-01' }), steady(), TODAY)
    const behind = forecastGoal(goal({ by: '2026-11-15' }), steady(), TODAY)
    expect(ahead.kind === 'eta' && ahead.status).toBe('ahead')
    expect(behind.kind === 'eta' && behind.status).toBe('behind')
  })

  it('deload haftası eğimi bozmaz: o güne kadarki en iyi değer kullanılır', () => {
    const ws = steady()
    // 14 gün önceki seans deload: 60 kg.
    ws[6] = wk(14, 60)
    const f = forecastGoal(goal(), ws, TODAY)
    expect(f.kind).toBe('eta')
    if (f.kind !== 'eta') return
    expect(f.current).toBe(88)
    // Deload seansı yerine önceki en iyi (85) sayılır; eğim hâlâ pozitif ve 1 kg/hafta civarında.
    expect(f.perWeek).toBeGreaterThan(0.8)
  })

  it('8 haftadan eski seanslar eğime girmez', () => {
    const ws = [wk(200, 40), wk(150, 50), ...steady()]
    const f = forecastGoal(goal(), ws, TODAY)
    expect(f.kind === 'eta' && f.perWeek).toBeCloseTo(1, 6)
  })
})

describe('forecastGoal: yetersiz veri', () => {
  it('pencerede 4\'ten az seans: tarih yok', () => {
    const f = forecastGoal(goal(), [wk(21, 80), wk(14, 82), wk(7, 84)], TODAY)
    expect(f).toEqual({ kind: 'noData', sessions: 3, current: 84 })
    expect(describeForecast(f, goal(), 'kg', NOW)).toContain('veri yetersiz')
  })

  it('seanslar 2 haftadan kısa bir aralıktaysa tarih yok', () => {
    const f = forecastGoal(goal(), [wk(6, 80), wk(4, 82), wk(2, 84), wk(0, 86)], TODAY)
    expect(f.kind).toBe('noData')
  })

  it('hiç seans yoksa', () => {
    const f = forecastGoal(goal(), [wk(100, 80)], TODAY)
    expect(f).toEqual({ kind: 'noData', sessions: 0, current: undefined })
    expect(describeForecast(f, goal(), 'kg', NOW)).toContain('seans yok')
  })

  it('düz eğim: tarih uydurulmaz', () => {
    const ws = [42, 35, 28, 21, 14, 7, 0].map((ago) => wk(ago, 90))
    const f = forecastGoal(goal(), ws, TODAY)
    expect(f).toEqual({ kind: 'flat', current: 90 })
    expect(describeForecast(f, goal(), 'kg', NOW)).toBe('Son 8 haftada tahmini 1RM artmıyor; bu gidişle bir tarih verilemez.')
  })

  it('düşen performans da düz sayılır', () => {
    const ws = [42, 35, 28, 21, 14, 7, 0].map((ago, i) => wk(ago, 95 - i))
    expect(forecastGoal(goal(), ws, TODAY).kind).toBe('flat')
  })

  it('süreli seanslar seans sayılmaz', () => {
    const ws = [28, 21, 14, 7, 0].map((ago) => wk(ago, 0, 60, { timed: true }))
    expect(forecastGoal(goal(), ws, TODAY).kind).toBe('noData')
  })
})

describe('ulaşılmış hedef', () => {
  it('oluşturma gününden sonraki ilk ulaşan seans', () => {
    const ws = [wk(10, 90), wk(5, 75, 10), wk(0, 101)]
    // 75 × (1 + 10/30) = 100: tam sınır da sayılır.
    expect(reachedOn(goal({ created: addDays(TODAY, -7) }), goalHistory(ws, 'bench'))).toBe(addDays(TODAY, -5))
  })

  it('oluşturmadan önceki rekor hedefi tamamlamaz', () => {
    const ws = [wk(30, 105), wk(0, 95)]
    expect(reachedOn(goal({ created: addDays(TODAY, -10) }), goalHistory(ws, 'bench'))).toBeUndefined()
  })

  it('forecastGoal ulaşılmış hedefi bildirir; kayıtlı `done` önceliklidir', () => {
    const ws = [...steady(), wk(0, 100)]
    const f = forecastGoal(goal(), ws, TODAY)
    expect(f).toMatchObject({ kind: 'reached', d: TODAY })
    expect(describeForecast(f, goal(), 'kg', NOW)).toBe('Hedefe ulaşıldı · 24 Ekim')
    expect(forecastGoal(goal({ done: '2026-10-01' }), [], TODAY)).toMatchObject({ kind: 'reached', d: '2026-10-01' })
  })

  it('newlyReached yalnız işaretlenmemişleri döner', () => {
    const ws = [wk(0, 110)]
    const goals = [goal(), goal({ id: 'g2', done: '2026-10-01' }), goal({ id: 'g3', target: 200 })]
    expect(newlyReached(goals, ws)).toEqual([{ id: 'g1', d: TODAY }])
  })
})

describe('describeForecast', () => {
  it('tahmini tarih, hedefe göre durum ve haftalık hız (birime uyar)', () => {
    const g = goal({ by: '2026-12-01' })
    const f = forecastGoal(g, steady(), TODAY)
    expect(describeForecast(f, g, 'kg', NOW)).toBe('Tahmini varış 16 Ocak 2027 · hedef tarihten 7 hafta geride (haftada +1 kg)')
    expect(describeForecast(f, g, 'lb', NOW)).toContain('haftada +2,2 lb')
    const early = goal({ by: '2027-06-01' })
    expect(describeForecast(forecastGoal(early, steady(), TODAY), early, 'kg', NOW)).toContain('hedef tarihten 19 hafta önce')
  })
})
