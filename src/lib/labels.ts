import { MUSCLE_LABEL } from './muscles.ts'

/**
 * free-exercise-db ekipman adları (exercises.json ile birebir) → Türkçe gösterim.
 * Egzersiz adları İngilizce kaldığı için barbell/dumbbell/kettlebell yaygın kullanımla aynen bırakıldı.
 */
export const EQUIPMENT_LABEL: Record<string, string> = {
  'body only': 'Vücut ağırlığı',
  machine: 'Makine',
  other: 'Diğer',
  'foam roll': 'Köpük rulo',
  kettlebells: 'Kettlebell',
  dumbbell: 'Dumbbell',
  cable: 'Kablo',
  barbell: 'Barbell',
  bands: 'Lastik bant',
  'medicine ball': 'Sağlık topu',
  'exercise ball': 'Pilates topu',
  'e-z curl bar': 'EZ bar',
}

/** Veri anahtarı (İngilizce) → Türkçe etiket. Tanınmayan değer (kullanıcının yazdığı özel kas) olduğu gibi döner. */
export function muscleLabel(muscle: string): string {
  return (MUSCLE_LABEL as Record<string, string>)[muscle] ?? muscle
}

/** Ekipman yoksa (null) "Ekipmansız"; tanınmayan değer olduğu gibi döner. */
export function equipmentLabel(equipment: string | null): string {
  if (!equipment) return 'Ekipmansız'
  return EQUIPMENT_LABEL[equipment] ?? equipment
}
