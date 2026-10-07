import type { Workout } from '../store/schema.ts'
import { dayString } from './workout.ts'

/** Verilen günün ait olduğu haftanın başlangıcı (yerel gün, saat sıfırlanmış). */
export function weekStartOf(date: Date, weekStart: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = (d.getDay() - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

/**
 * Üst üste antrenman yapılan hafta sayısı. İçinde bulunulan haftada henüz antrenman yoksa
 * seri bozulmaz; önceki haftadan saymaya devam eder.
 */
export function weekStreak(workouts: Workout[], today: Date, weekStart: number): number {
  const trained = new Set(workouts.map((w) => w.d))
  const hasWorkoutIn = (start: Date): boolean => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      if (trained.has(dayString(d))) return true
    }
    return false
  }

  let cursor = weekStartOf(today, weekStart)
  if (!hasWorkoutIn(cursor)) cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7)

  let streak = 0
  while (hasWorkoutIn(cursor)) {
    streak++
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7)
  }
  return streak
}
