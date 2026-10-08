import type { Routine, Workout } from '../store/schema.ts'

export interface NextRoutine {
  /** Sırada olan rutin. */
  routine: Routine
  /** En son yapılan (hâlâ var olan) rutin; geçmiş yoksa undefined. */
  last?: Routine
}

/**
 * Rutinlerin sırasına göre rotasyonda sıradaki rutini bulur (A -> B -> A).
 * `workouts` biten antrenmanlardır (eskiden yeniye); devam eden antrenman store'da ayrı tutulur
 * ve buraya verilmez. Silinmiş rutine ya da rutinsiz (serbest) antrenmana bağlı kayıtlar atlanır.
 * Eşleşen geçmiş yoksa ilk rutin; rutin yoksa undefined.
 */
export function suggestNextRoutine(routines: Routine[], workouts: Workout[]): NextRoutine | undefined {
  if (routines.length === 0) return undefined
  for (let i = workouts.length - 1; i >= 0; i--) {
    const id = workouts[i].routineId
    if (!id) continue
    const at = routines.findIndex((r) => r.id === id)
    if (at < 0) continue
    return { routine: routines[(at + 1) % routines.length], last: routines[at] }
  }
  return { routine: routines[0] }
}
