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

/** Takvim haftası aralıkları: yerel YYYY-MM-DD, iki uç da dahil (muscleSets ile aynı). */
export interface WeekRanges {
  thisFrom: string
  /** Bugün (hafta henüz bitmedi). */
  thisTo: string
  lastFrom: string
  /** Geçen haftanın son günü: bu haftanın başlangıcından bir önceki gün. */
  lastTo: string
  /** Bu haftanın kaçıncı günündeyiz (1..7, bugün dahil). */
  daysElapsed: number
}

/** weekStart 0=Pazar..6=Cumartesi; geçersiz değer Pazartesi'ye (1) düşer, taşan değer mod 7 alınır. */
function normalizeWeekStart(weekStart: number): number {
  if (!Number.isFinite(weekStart)) return 1
  return ((Math.floor(weekStart) % 7) + 7) % 7
}

/**
 * Kullanıcının hafta başlangıcına göre "bu hafta (başından bugüne)" ve "geçen hafta (tam hafta)".
 * Tarih aritmetiği yerel takvim günü üzerinden (new Date(y, m, d + n)) yapılır, 24 saat eklenmez;
 * böylece yaz/kış saati geçişi haftayı kaydırmaz.
 */
export function weekRanges(today: Date = new Date(), weekStart: number = 1): WeekRanges {
  const ws = normalizeWeekStart(weekStart)
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  const back = (today.getDay() - ws + 7) % 7
  const start = new Date(y, m, d - back)
  const sy = start.getFullYear()
  const sm = start.getMonth()
  const sd = start.getDate()
  return {
    thisFrom: dayString(start),
    thisTo: dayString(new Date(y, m, d)),
    lastFrom: dayString(new Date(sy, sm, sd - 7)),
    lastTo: dayString(new Date(sy, sm, sd - 1)),
    daysElapsed: back + 1,
  }
}

export interface WeekComparison {
  ranges: WeekRanges
  /** Bu hafta, haftanın başından bugüne. */
  thisWeek: MuscleSets
  /** Geçen takvim haftası (tam). */
  lastWeek: MuscleSets
  /** thisWeek - lastWeek. Bu hafta henüz yarım olduğundan negatif fark "geride" demek değildir. */
  delta: MuscleSets
}

/** Bu hafta ve geçen hafta için kas başına ağırlıklı set ve fark. */
export function weekComparison(
  workouts: Workout[],
  byId: ReadonlyMap<string, MuscleInfo>,
  today: Date = new Date(),
  weekStart: number = 1,
): WeekComparison {
  const ranges = weekRanges(today, weekStart)
  const thisWeek = muscleSets(workouts, byId, { from: ranges.thisFrom, to: ranges.thisTo })
  const lastWeek = muscleSets(workouts, byId, { from: ranges.lastFrom, to: ranges.lastTo })
  const delta = emptyMuscleSets()
  for (const m of MUSCLES) delta[m] = thisWeek[m] - lastWeek[m]
  return { ranges, thisWeek, lastWeek, delta }
}

export interface UnderTarget {
  muscle: MuscleId
  sets: number
  target: number
  /** target - sets (> 0). */
  gap: number
}

/**
 * Hedefin altındaki kaslar, hedefe en uzak olandan başlayarak (eşitlikte MUSCLES sırası).
 * `eligible` verilirse yalnız o kaslar değerlendirilir (ör. yakın zamanda çalışılmış olanlar).
 * Geçen (tam) hafta için doğrudan "hedefin altında" anlamına gelir; içinde bulunulan hafta için
 * arayüz bunu "hedefe ilerleme" olarak çerçevelemelidir.
 */
export function underTargetMuscles(
  sets: MuscleSets,
  options: { target?: number; limit?: number; eligible?: (m: MuscleId) => boolean } = {},
): UnderTarget[] {
  const target = options.target ?? WEEKLY_TARGET_SETS
  const out: UnderTarget[] = []
  for (const m of MUSCLES) {
    if (options.eligible && !options.eligible(m)) continue
    if (sets[m] < target) out.push({ muscle: m, sets: sets[m], target, gap: target - sets[m] })
  }
  out.sort((a, b) => b.gap - a.gap)
  return options.limit === undefined ? out : out.slice(0, Math.max(0, options.limit))
}
