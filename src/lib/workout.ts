import type { BodyweightEntry, ProgressionRule, Routine, SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
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
 * Egzersizin son iki karşılaştırılabilir kaydı. `last`, `lastEntryFor` ile aynıdır ve `comparableLast`
 * gibi yalnız aynı ağırlık anlamındaysa (`bw`) ve aynı türdeyse (`timed`: saniye mi tekrar mı) döner;
 * `prev` bir önceki kayıttır ve farklı anlamdaysa yoktur (ek yükle girilmiş ile mutlak yükle girilmiş
 * seans onay sayılmaz).
 */
export function lastTwoEntriesFor(
  workouts: Workout[],
  exId: string,
  bw: boolean,
  timed = false,
): { last?: WorkoutEntry; prev?: WorkoutEntry } {
  const found: WorkoutEntry[] = []
  for (let i = workouts.length - 1; i >= 0 && found.length < 2; i--) {
    const entry = workouts[i].entries.find((e) => e.exId === exId)
    if (entry && workSets(entry.sets).length > 0) found.push(entry)
  }
  const last = comparableLast(found[0], bw, timed)
  return { last, prev: last ? comparableLast(found[1], bw, timed) : undefined }
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
  rule?: ProgressionRule,
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
      const timed = !!cfg.timed
      const { last, prev } = lastTwoEntriesFor(history, cfg.exId, bw, timed)
      const p = nextPrescription(cfg, last, { prev, rule })
      const work: SetEntry[] = Array.from({ length: cfg.sets }, () => ({ w: p.w, r: p.r, done: false }))
      const bwKg = bw ? bodyweightOn(bodyweight, d) : undefined
      // Süreli egzersizde ısınma rampası anlamsızdır (tekrar yok); rutinde sayı kalsa da atlanır.
      const warmups = timed ? [] : warmupSets(p.w, cfg.warmups ?? 0, bwKg)
      const entry: WorkoutEntry = { exId: cfg.exId, sets: [...warmups, ...work] }
      if (cfg.superset && i > 0) entry.linked = true
      if (cfg.restSec && cfg.restSec > 0) entry.restSec = cfg.restSec
      if (timed) entry.timed = true
      if (bw) {
        entry.bw = true
        if (bwKg !== undefined) entry.bwKg = bwKg
      }
      if (cfg.side) {
        entry.unilateral = true
        entry.sets = toUnilateral(entry.sets)
      }
      // Dropsetler son çalışma setinden zincirlenir (tek taraflıysa sol/sağ hedefleri de taşınır).
      const lastWork = entry.sets[entry.sets.length - 1]
      if (lastWork && cfg.drops) entry.sets = [...entry.sets, ...dropChain(lastWork, cfg.drops, bwKg)]
      return entry
    }),
  }
}

/** Rutinsiz, egzersizleri seans sırasında seçilen antrenmanın adı. */
export const FREE_WORKOUT_NAME = 'Serbest antrenman'

/** Rutinsiz boş bir seans kurar; egzersizler seans sırasında eklenir (`addExerciseToActive`). */
export function buildFreeWorkout(now: number): Workout {
  return { id: newId(), d: dayString(new Date(now)), start: now, name: FREE_WORKOUT_NAME, entries: [] }
}

/** Sonradan eklenen bir egzersizin kaç set kurulacağının üst sınırı (uzun bir geçmiş seansı şişirmesin). */
const MAX_PREFILL_SETS = 6

/**
 * Egzersizin son karşılaştırılabilir seansındaki kurulum: tamamlanan çalışma seti sayısı, en ağır set
 * ağırlığı ve en düşük tekrar ("son seansındaki gibi"; süreli egzersizde en kısa süre, sn). Isınma ve
 * dropset sayılmaz; geçmiş yoksa null.
 * Rutin planı ve ilerleme kuralı yerine, rutinsiz eklenen egzersizlerde başlangıç değeri olarak kullanılır.
 */
export function lastSetup(
  history: Workout[],
  exId: string,
  bw: boolean,
  timed = false,
): { sets: number; w: number; r: number } | null {
  const { last } = lastTwoEntriesFor(history, exId, bw, timed)
  if (!last) return null
  const work = workSets(last.sets).filter((s) => !s.drop)
  if (work.length === 0) return null
  return {
    sets: Math.min(work.length, MAX_PREFILL_SETS),
    w: Math.max(...work.map((s) => s.w)),
    r: Math.max(1, Math.min(...work.map((s) => s.r))),
  }
}

/**
 * Tamamlanan çalışma setlerinde toplam hacim (kg × tekrar). Tek taraflı setlerde sol + sağ
 * tekrarların toplamı kullanılır; ağırlık taraf başına olduğundan her iki tarafın işi sayılır.
 * Vücut ağırlığı egzersizlerinde yük, vücut ağırlığı + ek yüktür (bkz. `effectiveLoad`); asist yükü
 * vücut ağırlığını aşarsa hacim negatife inmez. Süreli egzersizler (`timed`) hacme girmez: `r` saniyedir,
 * kg × saniye anlamsız bir sayı olurdu; yine de çalışma seti olarak sayılırlar (doneSetCount, kas haritası).
 */
export function workoutVolume(workout: Workout): number {
  return workout.entries.reduce(
    (sum, e) =>
      e.timed
        ? sum
        : sum +
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
  /** Tahmini 1RM; süreli seansta 0 (1RM tanımsızdır). */
  e1rm: number
  /** Süreli seans: `topSec` o seanstaki en uzun tutuş (sn). */
  timed?: true
  topSec?: number
}

/** Egzersizin seans bazlı en iyi set geçmişi (grafik için), eski→yeni. */
export function exerciseHistory(workouts: Workout[], exId: string): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (const wk of workouts) {
    const entry = wk.entries.find((e) => e.exId === exId)
    if (!entry) continue
    const sets = workSets(entry.sets)
    if (sets.length === 0) continue
    if (entry.timed) {
      points.push({
        d: wk.d,
        topW: Math.max(0, ...sets.map((s) => effectiveLoad(entry, s.w))),
        e1rm: 0,
        timed: true,
        topSec: Math.max(...sets.map((s) => s.r)),
      })
      continue
    }
    points.push({
      d: wk.d,
      topW: Math.max(0, ...sets.map((s) => effectiveLoad(entry, s.w))),
      e1rm: Math.max(...sets.map((s) => estimate1RM(effectiveLoad(entry, s.w), s.r))),
    })
  }
  return points
}

/**
 * Bu seansın bir egzersizinde tahmini 1RM, önceki tüm seansları geçti mi? Süreli egzersizde ölçü en
 * uzun tutuştur (sn, ek yüke bakılmaz); yalnız önceki süreli seanslarla karşılaştırılır.
 */
export function isPR(previous: Workout[], entry: WorkoutEntry): boolean {
  if (entry.timed) {
    const bestHold = Math.max(0, ...exerciseHistory(previous, entry.exId).map((p) => p.topSec ?? 0))
    const hold = Math.max(0, ...workSets(entry.sets).map((s) => s.r))
    return hold > 0 && hold > bestHold
  }
  const best = Math.max(0, ...exerciseHistory(previous, entry.exId).map((p) => p.e1rm))
  const now = Math.max(0, ...workSets(entry.sets).map((s) => estimate1RM(effectiveLoad(entry, s.w), s.r)))
  return now > 0 && now > best
}
