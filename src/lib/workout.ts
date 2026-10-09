import type { BodyweightEntry, Routine, SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { dropChain, warmupSets } from './intensity.ts'
import { bodyweightOn, comparableLast, effectiveLoad } from './load.ts'
import { estimate1RM } from './onerm.ts'
import { nextPrescription } from './progression.ts'
import { setReps, toUnilateral } from './sets.ts'

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

export function workSets(sets: SetEntry[]): SetEntry[] {
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

/**
 * Rutinden yeni bir seans kurar; ağırlık/tekrar progression önerisinden dolar. Vücut ağırlığı
 * egzersizlerine (`cfg.bw`) o günün vücut ağırlığı (`bodyweight` günlüğünden) anlık kopyalanır; ağırlık
 * ek yük olarak ilerler. Geçmiş kayıt farklı ağırlık anlamındaysa (`comparableLast`) yok sayılır.
 */
export function buildWorkout(
  routine: Routine,
  history: Workout[],
  now: number,
  bodyweight: readonly BodyweightEntry[] = [],
): Workout {
  const d = dayString(new Date(now))
  return {
    id: newId(),
    d,
    start: now,
    routineId: routine.id,
    name: routine.name,
    entries: routine.ex.map((cfg, i) => {
      const bw = !!cfg.bw
      const p = nextPrescription(cfg, comparableLast(lastEntryFor(history, cfg.exId), bw))
      const work: SetEntry[] = Array.from({ length: cfg.sets }, () => ({ w: p.w, r: p.r, done: false }))
      const warmups = warmupSets(p.w, cfg.warmups ?? 0)
      const entry: WorkoutEntry = { exId: cfg.exId, sets: [...warmups, ...work] }
      if (cfg.superset && i > 0) entry.linked = true
      if (bw) {
        entry.bw = true
        const bwKg = bodyweightOn(bodyweight, d)
        if (bwKg !== undefined) entry.bwKg = bwKg
      }
      if (cfg.side) {
        entry.unilateral = true
        entry.sets = toUnilateral(entry.sets)
      }
      // Dropsetler son çalışma setinden zincirlenir (tek taraflıysa sol/sağ hedefleri de taşınır).
      const lastWork = entry.sets[entry.sets.length - 1]
      if (lastWork && cfg.drops) entry.sets = [...entry.sets, ...dropChain(lastWork, cfg.drops)]
      return entry
    }),
  }
}

/**
 * Tamamlanan çalışma setlerinde toplam hacim (kg × tekrar). Tek taraflı setlerde sol + sağ
 * tekrarların toplamı kullanılır; ağırlık taraf başına olduğundan her iki tarafın işi sayılır.
 * Vücut ağırlığı egzersizlerinde yük, vücut ağırlığı + ek yüktür (bkz. `effectiveLoad`); asist yükü
 * vücut ağırlığını aşarsa hacim negatife inmez.
 */
export function workoutVolume(workout: Workout): number {
  return workout.entries.reduce(
    (sum, e) =>
      sum +
      e.sets
        .filter((s) => !s.warmup && (s.done || s.partial))
        .reduce((s, set) => s + Math.max(0, effectiveLoad(e, set.w)) * setReps(set), 0),
    0,
  )
}

/** Kaydedilmiş antrenmandaki yarım (tek tarafı yapılmış) set sayısı. */
export function partialSetCount(workout: Workout): number {
  return workout.entries.reduce((n, e) => n + e.sets.filter((s) => s.partial).length, 0)
}

/**
 * Seans bitişinde setin ne olacağı: tamamlandıysa aynen kalır; tek taraflıda tam bir taraf yapılmışsa
 * yarım set olarak (yapılmayan tarafın tekrarı 0) saklanır; hiç yapılmadıysa null.
 */
export function finalizeSet(set: SetEntry): SetEntry | null {
  if (set.done) return set
  if (!set.sides || set.warmup) return null
  const { L, R } = set.sides
  if (L.done === R.done) return null
  const kept = L.done ? L : R
  if (kept.r <= 0) return null
  const none = { r: 0, done: false }
  return { ...set, r: 0, done: false, partial: true, sides: L.done ? { L, R: none } : { L: none, R } }
}

export function doneSetCount(workout: Workout): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const e of workout.entries) {
    for (const s of e.sets) {
      if (s.warmup || s.drop) continue
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
      topW: Math.max(0, ...sets.map((s) => effectiveLoad(entry, s.w))),
      e1rm: Math.max(...sets.map((s) => estimate1RM(effectiveLoad(entry, s.w), s.r))),
    })
  }
  return points
}

/** Bu seansın bir egzersizinde tahmini 1RM, önceki tüm seansları geçti mi? */
export function isPR(previous: Workout[], entry: WorkoutEntry): boolean {
  const best = Math.max(0, ...exerciseHistory(previous, entry.exId).map((p) => p.e1rm))
  const now = Math.max(0, ...workSets(entry.sets).map((s) => estimate1RM(effectiveLoad(entry, s.w), s.r)))
  return now > 0 && now > best
}
