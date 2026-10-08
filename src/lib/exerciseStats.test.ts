import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import { exerciseSummary } from './exerciseStats.ts'

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })

const workout = (id: string, d: string, exId: string, sets: SetEntry[]): Workout => ({
  id,
  d,
  start: 0,
  name: 'A',
  entries: [{ exId, sets }],
})

describe('exerciseSummary', () => {
  it('geçmiş yoksa boş özet döner', () => {
    expect(exerciseSummary([], 'squat')).toEqual({ sessions: 0 })
    expect(exerciseSummary([workout('1', '2026-10-01', 'bench', [set(60, 8)])], 'squat')).toEqual({ sessions: 0 })
  })

  it('son seansı ve çalışma setlerini verir, ısınmayı ve yapılmayan seti saymaz', () => {
    const ws = [
      workout('1', '2026-10-01', 'squat', [set(80, 8)]),
      workout('2', '2026-10-05', 'squat', [set(40, 10, { warmup: true }), set(85, 8), set(85, 7, { done: false })]),
    ]
    const s = exerciseSummary(ws, 'squat')
    expect(s.sessions).toBe(2)
    expect(s.last?.d).toBe('2026-10-05')
    expect(s.last?.sets).toEqual([set(85, 8)])
  })

  it('en iyi seti tahmini 1RM ile seçer; eşitlikte ilk seansı korur', () => {
    const ws = [
      workout('1', '2026-10-01', 'bench', [set(100, 5)]),
      workout('2', '2026-10-03', 'bench', [set(100, 5)]),
      workout('3', '2026-10-06', 'bench', [set(60, 8)]),
    ]
    const s = exerciseSummary(ws, 'bench')
    expect(s.best).toMatchObject({ d: '2026-10-01', w: 100, r: 5 })
    expect(s.best?.e1rm).toBeCloseTo(100 * (1 + 5 / 30))
  })

  it('yalnız ısınma yapılan seansı seans saymaz', () => {
    const s = exerciseSummary([workout('1', '2026-10-01', 'squat', [set(40, 10, { warmup: true })])], 'squat')
    expect(s).toEqual({ sessions: 0 })
  })
})
