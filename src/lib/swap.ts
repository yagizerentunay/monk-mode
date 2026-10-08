import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import type { Exercise } from './exercises.ts'
import { dropSet, warmupSet } from './intensity.ts'
import { toUnilateral } from './sets.ts'
import { lastEntryFor } from './workout.ts'
import { nextPrescription } from './progression.ts'

/** Değiştir listesinde en fazla gösterilen alternatif sayısı. */
export const MAX_ALTERNATIVES = 30

/**
 * `current` yerine yapılabilecek egzersizler: ilk birincil kas aynı olmalı. Sıra: aynı ekipman önce,
 * sonra daha önce yapılmış olanlar (`usedIds`), sonra ada göre. Kendisi ve `excludeIds` (antrenmanda
 * zaten olanlar) listede yer almaz.
 */
export function alternativesFor(
  current: Exercise,
  all: Exercise[],
  excludeIds: Set<string>,
  usedIds: Set<string> = new Set(),
  limit: number = MAX_ALTERNATIVES,
): Exercise[] {
  const muscle = current.primaryMuscles[0]
  if (!muscle) return []
  const rank = (e: Exercise) => (e.equipment === current.equipment ? 0 : 2) + (usedIds.has(e.id) ? 0 : 1)
  return all
    .filter((e) => e.id !== current.id && !excludeIds.has(e.id) && e.primaryMuscles[0] === muscle)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit))
}

/** Egzersizde tamamlanmış ya da yarım kalmış herhangi bir set var mı? Varsa değiştirilemez. */
export function hasCompletedWork(entry: WorkoutEntry): boolean {
  return entry.sets.some((s) => s.done || s.partial)
}

/**
 * Henüz çalışılmamış bir egzersiz satırının yerine `exId` koyar; yapılmışsa null döner.
 *
 * - Çalışma seti sayısı korunur. Ağırlık/tekrar hedefi yeni egzersizin kendi geçmişinden (çift ilerleme,
 *   hedef tekrar = mevcut hedef) gelir; geçmişi yoksa tekrar korunur, ağırlık 0 olur (eski egzersizin
 *   yükü yenisine anlam taşımaz).
 * - Satırın yapısı (ısınma / çalışma / drop sırası ve sayıları) korunur; ısınmalar yeni çalışma
 *   ağırlığından, dropsetler önceki setin %80'inden yeniden hesaplanır. Tek tek elle yazılmış hedefler
 *   yenisinde ortak hedefe döner.
 * - Not silinir (eski egzersize aitti), süperset bağı (`linked`) korunur, tek taraflılık `side` ile belirlenir.
 */
export function swapEntry(entry: WorkoutEntry, exId: string, side: boolean, history: Workout[]): WorkoutEntry | null {
  if (hasCompletedWork(entry)) return null
  const work = entry.sets.filter((s) => !s.warmup && !s.drop)
  const reps = work[0]?.r ?? 8
  const p = nextPrescription(
    { exId, sets: work.length, reps, weight: 0, prog: 'double', inc: 2.5, repsMax: reps },
    lastEntryFor(history, exId),
  )
  const rebuilt: SetEntry[] = []
  let warm = 0
  for (const s of entry.sets) {
    if (s.warmup) rebuilt.push(warmupSet(p.w, warm++))
    else if (s.drop && rebuilt.length > 0) rebuilt.push(dropSet(rebuilt[rebuilt.length - 1]))
    else rebuilt.push({ w: p.w, r: p.r, done: false })
  }
  const { note: _note, unilateral: _uni, ...rest } = entry
  return side
    ? { ...rest, exId, unilateral: true, sets: toUnilateral(rebuilt) }
    : { ...rest, exId, sets: rebuilt }
}
