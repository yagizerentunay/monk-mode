import type { SetEntry, Workout } from '../store/schema.ts'

/** Seçilebilir RIR değerleri; `4` "4 ve üstü" demektir. */
export const RIR_CHOICES = [0, 1, 2, 3, 4]

export function rirLabel(rir: number): string {
  return rir >= 4 ? '4+' : String(rir)
}

/** RIR'in anlamlı olduğu set: tamamlanmış çalışma seti (ısınma ve dropset RIR tutmaz). */
export function isRirSet(set: SetEntry): boolean {
  return set.done && !set.warmup && !set.drop
}

/**
 * `sets[index]`ten önceki en yakın tamamlanmış çalışma setinin RIR'i; yoksa ya da o sette RIR girilmemişse
 * undefined. Yalnız "Aynı (N)" önerisi için okunur: değer asla kendiliğinden yazılmaz, kullanıcı dokunur.
 */
export function previousRir(sets: SetEntry[], index: number): number | undefined {
  for (let i = index - 1; i >= 0; i--) {
    if (isRirSet(sets[i])) return sets[i].rir
  }
  return undefined
}

export interface MissingRir {
  /** Antrenmandaki egzersiz sırası (aynı egzersiz iki kez geçebilir, bu yüzden kimlik değil sıra). */
  entryIdx: number
  exId: string
  /** O egzersizde RIR'i boş tamamlanmış çalışma seti sayısı. */
  count: number
}

/** RIR'i eksik set içeren egzersizler, antrenman sırasıyla. Eksiksiz egzersiz listeye girmez. */
export function missingRirByExercise(workout: Workout): MissingRir[] {
  const out: MissingRir[] = []
  workout.entries.forEach((e, entryIdx) => {
    const count = e.sets.filter((s) => isRirSet(s) && s.rir === undefined).length
    if (count > 0) out.push({ entryIdx, exId: e.exId, count })
  })
  return out
}

export function missingRirCount(workout: Workout): number {
  return missingRirByExercise(workout).reduce((sum, m) => sum + m.count, 0)
}

export interface RirCoverage {
  /** RIR girilmiş tamamlanmış çalışma seti. */
  withRir: number
  /** Tamamlanmış çalışma seti. */
  total: number
  /** Tam sayıya yuvarlanmış yüzde; hiç set yoksa null. */
  pct: number | null
}

export function rirCoverage(workout: Workout): RirCoverage {
  let total = 0
  let withRir = 0
  for (const e of workout.entries) {
    for (const s of e.sets) {
      if (!isRirSet(s)) continue
      total++
      if (s.rir !== undefined) withRir++
    }
  }
  return { withRir, total, pct: total === 0 ? null : Math.round((withRir / total) * 100) }
}

/**
 * Bir egzersizin RIR'i boş tamamlanmış çalışma setlerinin hepsine `rir` yazar (dolu olanlara, ısınma ve
 * dropa dokunmaz). Girdiyi değiştirmez; uygulanacak bir şey yoksa aynı nesneyi döndürür.
 */
export function applyRirToEntry(workout: Workout, entryIdx: number, rir: number): Workout {
  const entry = workout.entries[entryIdx]
  if (!entry || !entry.sets.some((s) => isRirSet(s) && s.rir === undefined)) return workout
  const sets = entry.sets.map((s) => (isRirSet(s) && s.rir === undefined ? { ...s, rir } : s))
  return { ...workout, entries: workout.entries.map((e, i) => (i === entryIdx ? { ...e, sets } : e)) }
}
