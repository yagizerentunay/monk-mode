import type { SetEntry, WorkoutEntry } from '../store/schema.ts'

/**
 * Ağırlığı gerçekten 0 olamayacak ekipmanlar (free-exercise-db adlarıyla). Yalnız dış yük gerektirdiği
 * açık olanlar listelenir: `body only`, `bands`, `other`, boş ve tanınmayan değerler muaftır.
 */
const EXTERNAL_LOAD = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'e-z curl bar'])

/** Ekipman dış yük gerektiriyor mu? Özel egzersizlerin serbest metni de aynı karşılaştırmadan geçer. */
export function needsExternalLoad(equipment: string | null | undefined): boolean {
  return !!equipment && EXTERNAL_LOAD.has(equipment.trim().toLowerCase())
}

/**
 * Tamamlanmış bir çalışma setinde ağırlık 0 (ya da altı) mı ve bu egzersiz için şüpheli mi?
 * Isınma, tamamlanmamış set, vücut ağırlığı girdisi (`bw`: ek yük 0 normal) ve dış yük gerektirmeyen
 * ekipman muaftır. Tek taraflı sette `w` taraf başı ağırlıktır; kural aynıdır.
 */
export function isZeroWeightSet(
  entry: Pick<WorkoutEntry, 'bw'>,
  set: Pick<SetEntry, 'w' | 'done' | 'warmup'>,
  equipment: string | null | undefined,
): boolean {
  return set.done && !set.warmup && set.w <= 0 && !entry.bw && needsExternalLoad(equipment)
}

/** Girdinin her seti için `isZeroWeightSet` sonucu (set sırasıyla). */
export function zeroWeightFlags(entry: WorkoutEntry, equipment: string | null | undefined): boolean[] {
  return entry.sets.map((s) => isZeroWeightSet(entry, s, equipment))
}
