import type { Routine, SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { estimate1RM } from './onerm.ts'
import { nextPrescription } from './progression.ts'

/** Yerel takvim günü, YYYY-MM-DD. */
export function dayString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function workSets(sets: SetEntry[]): SetEntry[] {
  return sets.filter((s) => !s.warmup && s.done)
}

/** Egzersizin son tamamlanmış kaydı; yoksa undefined. `workouts` eski→yeni sıralıdır. */
export function lastEntryFor(workouts: Workout[], exId: string): WorkoutEntry | undefined {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const entry = workouts[i].entries.find((e) => e.exId === exId)
    if (entry && workSets(entry.sets).length > 0) return entry
  }
  return undefined
}

/** Rutinden yeni bir seans kurar; ağırlık/tekrar progression önerisinden dolar. */
export function buildWorkout(routine: Routine, history: Workout[], now: number): Workout {
  return {
    id: newId(),
    d: dayString(new Date(now)),
    start: now,
    routineId: routine.id,
    name: routine.name,
    entries: routine.ex.map((cfg) => {
      const p = nextPrescription(cfg, lastEntryFor(history, cfg.exId))
      return {
        exId: cfg.exId,
        sets: Array.from({ length: cfg.sets }, () => ({ w: p.w, r: p.r, done: false })),
      }
    }),
  }
}

/** Tamamlanan çalışma setlerinde toplam hacim (kg × tekrar). */
export function workoutVolume(workout: Workout): number {
  return workout.entries.reduce(
    (sum, e) => sum + workSets(e.sets).reduce((s, set) => s + set.w * set.r, 0),
    0,
  )
}

export function doneSetCount(workout: Workout): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const e of workout.entries) {
    for (const s of e.sets) {
      if (s.warmup) continue
      total++
      if (s.done) done++
    }
  }
  return { done, total }
}

export interface ExercisePoint {
  d: string
  topW: number
  e1rm: number
}

/** Egzersizin seans bazlı en iyi set geçmişi (grafik için), eski→yeni. */
export function exerciseHistory(workouts: Workout[], exId: string): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (const wk of workouts) {
    const entry = wk.entries.find((e) => e.exId === exId)
    if (!entry) continue
    const sets = workSets(entry.sets)
    if (sets.length === 0) continue
    points.push({
      d: wk.d,
      topW: Math.max(...sets.map((s) => s.w)),
      e1rm: Math.max(...sets.map((s) => estimate1RM(s.w, s.r))),
    })
  }
  return points
}

/** Bu seansın bir egzersizinde tahmini 1RM, önceki tüm seansları geçti mi? */
export function isPR(previous: Workout[], entry: WorkoutEntry): boolean {
  const best = Math.max(0, ...exerciseHistory(previous, entry.exId).map((p) => p.e1rm))
  const now = Math.max(0, ...workSets(entry.sets).map((s) => estimate1RM(s.w, s.r)))
  return now > 0 && now > best
}
