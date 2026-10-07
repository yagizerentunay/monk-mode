import { describe, expect, it } from 'vitest'
import type { Routine, Workout } from '../store/schema.ts'
import {
  buildWorkout,
  dayString,
  doneSetCount,
  exerciseHistory,
  isPR,
  lastEntryFor,
  workoutVolume,
} from './workout.ts'

const done = (w: number, r: number) => ({ w, r, done: true })

function wk(d: string, exId: string, sets: Workout['entries'][number]['sets']): Workout {
  return { id: d, d, start: 0, name: 't', entries: [{ exId, sets }] }
}

const routine: Routine = {
  id: 'r1',
  name: 'Push',
  ex: [{ exId: 'bench', sets: 3, reps: 5, weight: 60, prog: 'linear', inc: 2.5, repsMax: 8 }],
}

describe('workout yardımcıları', () => {
  it('yerel günü YYYY-MM-DD yazar', () => {
    expect(dayString(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08')
  })

  it('geçmiş yokken plan ağırlığıyla başlar', () => {
    const w = buildWorkout(routine, [], Date.UTC(2026, 9, 8, 12))
    expect(w.entries[0].sets).toHaveLength(3)
    expect(w.entries[0].sets[0]).toEqual({ w: 60, r: 5, done: false })
  })

  it('başarılı geçmişte progression ağırlığı artırır', () => {
    const history = [wk('2026-10-01', 'bench', [done(60, 5), done(60, 5), done(60, 5)])]
    const w = buildWorkout(routine, history, Date.UTC(2026, 9, 8, 12))
    expect(w.entries[0].sets[0].w).toBe(62.5)
  })

  it('son kaydı bulurken tamamlanmamış seansı atlar', () => {
    const history = [
      wk('2026-10-01', 'bench', [done(60, 5)]),
      wk('2026-10-05', 'bench', [{ w: 70, r: 5, done: false }]),
    ]
    expect(lastEntryFor(history, 'bench')?.sets[0].w).toBe(60)
  })

  it('hacmi yalnız tamamlanan çalışma setlerinden hesaplar', () => {
    const w = wk('2026-10-08', 'bench', [
      done(100, 5),
      { w: 100, r: 5, done: false },
      { w: 20, r: 10, done: true, warmup: true },
    ])
    expect(workoutVolume(w)).toBe(500)
    expect(doneSetCount(w)).toEqual({ done: 1, total: 2 })
  })

  it('egzersiz geçmişini seans başına tek noktaya indirir', () => {
    const history = [wk('2026-10-01', 'bench', [done(60, 5), done(62.5, 3)])]
    const [p] = exerciseHistory(history, 'bench')
    expect(p.topW).toBe(62.5)
    expect(p.e1rm).toBeCloseTo(70, 0)
  })

  it('PR yalnız önceki en iyiyi aşınca verilir', () => {
    const prev = [wk('2026-10-01', 'bench', [done(100, 5)])]
    expect(isPR(prev, wk('2026-10-08', 'bench', [done(102.5, 5)]).entries[0])).toBe(true)
    expect(isPR(prev, wk('2026-10-08', 'bench', [done(100, 5)]).entries[0])).toBe(false)
  })

  it('ilk kayıt PR sayılır', () => {
    expect(isPR([], wk('2026-10-08', 'bench', [done(40, 8)]).entries[0])).toBe(true)
  })
})
