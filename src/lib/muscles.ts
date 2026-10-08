import type { Workout } from '../store/schema.ts'
import { dayString } from './workout.ts'

// free-exercise-db kas adları (exercises.json ile birebir aynı).
export const MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const

export type MuscleId = (typeof MUSCLES)[number]

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  abdominals: 'Karın',
  abductors: 'Kalça dış',
  adductors: 'Kalça iç',
  biceps: 'Biseps',
  calves: 'Baldır',
  chest: 'Göğüs',
  forearms: 'Ön kol',
  glutes: 'Kalça',
  hamstrings: 'Arka bacak',
  lats: 'Sırt (lat)',
  'lower back': 'Bel',
  'middle back': 'Orta sırt',
  neck: 'Boyun',
  quadriceps: 'Ön bacak',
  shoulders: 'Omuz',
  traps: 'Trapez',
  triceps: 'Triseps',
}

export type MuscleSets = Record<MuscleId, number>

export function emptyMuscleSets(): MuscleSets {
  return Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleSets
}

/** Yardımcı (ikincil) kas bir sette yarım set sayılır. */
export const SECONDARY_WEIGHT = 0.5

/** Haftalık hedef: kas başına 10 sert set (hipertrofi için yaygın alt-orta aralık). */
export const WEEKLY_TARGET_SETS = 10

const MUSCLE_SET: ReadonlySet<string> = new Set(MUSCLES)

interface MuscleInfo {
  primaryMuscles: string[]
  secondaryMuscles?: string[]
}

/** Aralıktaki antrenmanlarda kas başına ağırlıklı sert set sayısı (ısınma ve yapılmamış setler hariç). */
export function muscleSets(
  workouts: Workout[],
  byId: ReadonlyMap<string, MuscleInfo>,
  range: { from: string; to?: string },
): MuscleSets {
  const out = emptyMuscleSets()
  for (const w of workouts) {
    if (w.d < range.from) continue
    if (range.to !== undefined && w.d > range.to) continue
    for (const entry of w.entries) {
      const ex = byId.get(entry.exId)
      if (!ex) continue
      // Tek taraflı set done=true ile tek set sayılır; sides'a ayrıca bakmaya gerek yok.
      const hard = entry.sets.filter((s) => s.done && !s.warmup).length
      if (hard === 0) continue
      const primary = new Set(ex.primaryMuscles)
      for (const m of primary) {
        if (MUSCLE_SET.has(m)) out[m as MuscleId] += hard
      }
      // Hem birincil hem ikincil listedeyse yalnız birincil sayılır.
      for (const m of new Set(ex.secondaryMuscles ?? [])) {
        if (MUSCLE_SET.has(m) && !primary.has(m)) out[m as MuscleId] += hard * SECONDARY_WEIGHT
      }
    }
  }
  return out
}

/** Bugün dahil son `days` günü kapsayan pencerenin ilk günü (YYYY-MM-DD, yerel). */
export function sinceDay(days: number, today: Date = new Date()): string {
  const n = Math.max(1, Math.floor(days) || 1)
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1))
  return dayString(d)
}

/** Isı değeri 0..1: haftalık hedefin dönem uzunluğuna ölçeklenmiş hâline oranı. */
export function muscleLevel(sets: number, periodDays: number): number {
  if (!Number.isFinite(sets) || !Number.isFinite(periodDays) || periodDays <= 0) return 0
  const target = (WEEKLY_TARGET_SETS * periodDays) / 7
  return Math.min(1, Math.max(0, sets / target))
}
