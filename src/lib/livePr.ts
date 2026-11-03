import type { Workout, WorkoutEntry } from '../store/schema.ts'
import { effectiveLoad } from './load.ts'
import { estimate1RM } from './onerm.ts'
import { exerciseHistory } from './workout.ts'

/**
 * Az önce tamamlanan set (`entry.sets[setIndex]`) egzersizin tahmini 1RM rekorunu kırdı mı? Kırdıysa yeni
 * tahmini 1RM'i (kg) döner. Rekor, `previous` (biten antrenmanlar) ile bu seansta daha önce tamamlanan
 * çalışma setlerinin en iyisinden büyük olmalıdır; böylece aynı değer iki kez, ama her gerçek artış bildirilir.
 * Ölçüt `isPR` ve rekor listesiyle aynıdır (ısınma, dropset, yarım ve
 * yapılmamış set sayılmaz); süreli ve mesafe egzersizinde bildirim yoktur. Egzersizin hiç geçmişi yoksa
 * undefined: ilk seansta her set "rekor" olurdu.
 */
export function liveRecord(previous: Workout[], entry: WorkoutEntry, setIndex: number): number | undefined {
  if (entry.timed || entry.distance) return undefined
  const set = entry.sets[setIndex]
  if (!set || !set.done || set.warmup || set.drop || set.partial) return undefined
  const before = Math.max(0, ...exerciseHistory(previous, entry.exId).filter((p) => !p.distance && !p.timed).map((p) => p.e1rm))
  if (before <= 0) return undefined
  const e1rm = (s: { w: number; r: number; rir?: number }) => estimate1RM(effectiveLoad(entry, s.w), s.r, s.rir)
  const earlier = entry.sets.filter((s, i) => i !== setIndex && s.done && !s.warmup && !s.drop && !s.partial)
  const bar = Math.max(before, ...earlier.map(e1rm))
  const now = e1rm(set)
  return now > bar ? now : undefined
}
