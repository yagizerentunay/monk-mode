import type { Routine, Workout } from '../store/schema.ts'
import { parseDay } from './calendar.ts'
import { deriveSet } from './sets.ts'
import { buildWorkout } from './workout.ts'

/** O günün öğlesi (yerel 12:00), epoch ms; geçmişe girilen antrenmanın başlangıç zamanı olur. */
export function noonOf(date: string): number {
  const d = parseDay(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime()
}

/**
 * Geçmiş bir güne antrenman girmek için rutinden taslak kurar. Ağırlık ve tekrar önerisi yalnız o
 * günden ÖNCEKİ antrenmanlara bakar (sonradan yapılanlar geçmişteki öneriyi etkilemesin). Tüm setler
 * "yapıldı" gelir; kullanıcı düzenleyicide gerçek ağırlık/tekrarı düzeltir, yapılmayanı siler.
 */
export function draftForDate(routine: Routine, workouts: readonly Workout[], date: string): Workout {
  const before = workouts.filter((w) => w.d < date)
  const draft = buildWorkout(routine, before, noonOf(date))
  return {
    ...draft,
    d: date,
    entries: draft.entries.map((e) => ({
      ...e,
      sets: e.sets.map((s) =>
        s.sides
          ? deriveSet({ ...s, sides: { L: { ...s.sides.L, done: true }, R: { ...s.sides.R, done: true } } })
          : { ...s, done: true },
      ),
    })),
  }
}

/** Antrenmanı (d, start) sırasında doğru yere ekler; aynı kimlik varsa dokunmaz. */
export function insertWorkout(workouts: readonly Workout[], workout: Workout): Workout[] {
  if (workouts.some((w) => w.id === workout.id)) return [...workouts]
  return [...workouts, workout].sort((a, b) => a.d.localeCompare(b.d) || a.start - b.start)
}
