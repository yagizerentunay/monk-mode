import type { ExCfg, SetEntry, WorkoutEntry } from '../store/schema.ts'

export interface Prescription {
  /** Önerilen çalışma ağırlığı (kg). */
  w: number
  /** Önerilen hedef tekrar. */
  r: number
  /** Bu öneriyi doğuran gerekçe, arayüzde ipucu olarak gösterilir. */
  reason: 'plan' | 'increase' | 'repeat' | 'add-rep'
}

function workSets(entry: WorkoutEntry): SetEntry[] {
  return entry.sets.filter((s) => !s.warmup)
}

/** Seans, hedeflenen tüm çalışma setlerini tamamladı mı? */
function completedAll(entry: WorkoutEntry, targetSets: number): boolean {
  const sets = workSets(entry)
  return sets.length >= targetSets && sets.every((s) => s.done)
}

/**
 * Bir sonraki seansın önerisi. Geçmişten türetilir, saklanmaz.
 * `last`, aynı egzersizin son tamamlanmış kaydıdır (yoksa plan kullanılır).
 */
export function nextPrescription(cfg: ExCfg, last?: WorkoutEntry): Prescription {
  const plan: Prescription = { w: cfg.weight, r: cfg.reps, reason: 'plan' }
  if (!last || cfg.prog === 'off') return plan

  const sets = workSets(last).filter((s) => s.done)
  if (sets.length === 0) return plan

  const lastW = Math.max(...sets.map((s) => s.w))
  const allDone = completedAll(last, cfg.sets)

  if (cfg.prog === 'linear') {
    const hitReps = allDone && sets.every((s) => s.r >= cfg.reps)
    return hitReps
      ? { w: lastW + cfg.inc, r: cfg.reps, reason: 'increase' }
      : { w: lastW, r: cfg.reps, reason: 'repeat' }
  }

  // double progression: önce tekrar aralığının üstüne çık, sonra ağırlığı artır.
  const top = Math.max(cfg.repsMax, cfg.reps)
  if (allDone && sets.every((s) => s.r >= top)) {
    return { w: lastW + cfg.inc, r: cfg.reps, reason: 'increase' }
  }
  if (allDone) {
    const minReps = Math.min(...sets.map((s) => s.r))
    return { w: lastW, r: Math.min(minReps + 1, top), reason: 'add-rep' }
  }
  return { w: lastW, r: Math.max(Math.min(...sets.map((s) => s.r)), cfg.reps), reason: 'repeat' }
}
