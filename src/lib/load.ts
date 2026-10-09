import type { BodyweightEntry, WorkoutEntry } from '../store/schema.ts'
import { formatWeight, type Unit } from './units.ts'

/** Etkin yükü belirleyen girdi alanları. */
type LoadFields = Pick<WorkoutEntry, 'bw' | 'bwKg'>

/**
 * Setin gerçek yükü (kg). Vücut ağırlığı egzersizinde `w` ek yüktür (negatif = asist) ve toplam yük
 * seans kurulurken kopyalanan vücut ağırlığını içerir; kayıt yoksa o kısım 0 sayılır. `bw` yoksa
 * `w` mutlak yüktür (eski kayıtlar). Hacim, 1RM, PR ve plato hesapları hep bu değeri kullanır.
 */
export function effectiveLoad(entry: LoadFields, w: number): number {
  return entry.bw ? (entry.bwKg ?? 0) + w : w
}

/**
 * `day` günü ve öncesindeki en son vücut ağırlığı (kg); günlük boşsa ya da değer geçersizse undefined.
 * Sıralı olduğu varsayılmaz: aynı gün birden fazla kayıt varsa listede sonra gelen kazanır.
 */
export function bodyweightOn(log: readonly BodyweightEntry[], day: string): number | undefined {
  let latest: BodyweightEntry | undefined
  for (const b of log) if (b.d <= day && (!latest || b.d >= latest.d)) latest = b
  return latest && Number.isFinite(latest.w) && latest.w > 0 ? latest.w : undefined
}

/**
 * İlerleme önerisi ve ön doldurma için kullanılabilecek son kayıt. Yalnız aynı ağırlık anlamındaki
 * kayıt geçerlidir: ek yükle girilmiş (`bw`) ile mutlak yükle girilmiş kayıt karıştırılmaz. Aksi hâlde
 * eski "67 kg" barfiks kaydı, vücut ağırlığı moduna geçince 67 kg ek yük olarak ön dolardı.
 */
export function comparableLast(last: WorkoutEntry | undefined, bw: boolean): WorkoutEntry | undefined {
  return last && !!last.bw === bw ? last : undefined
}

/**
 * Setin ağırlığının gösterimi (birim eki olmadan, `formatSet` ile birleşir). Normal egzersizde "60";
 * vücut ağırlığı egzersizinde ek yük: "+10 kg", "−20 kg" (asist), 0 ise "Vücut ağırlığı".
 */
export function formatLoad(bw: boolean | undefined, w: number, unit: Unit): string {
  if (!bw) return formatWeight(w, unit)
  const text = formatWeight(Math.abs(w), unit)
  if (Number(text) === 0) return 'Vücut ağırlığı'
  return `${w > 0 ? '+' : '−'}${text} ${unit}`
}
