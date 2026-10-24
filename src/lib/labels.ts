import { labels, t } from '../i18n/index.ts'
import { MUSCLE_LABEL } from './muscles.ts'

/**
 * Egzersiz verisindeki ekipman adları (exercises.json ile birebir) → arayüz dilinde gösterim.
 * Egzersiz adları İngilizce kaldığı için barbell/dumbbell/kettlebell yaygın kullanımla aynen bırakıldı.
 */
export const EQUIPMENT_LABEL: Readonly<Record<string, string>> = labels({
  'body only': 'equipment.bodyOnly',
  machine: 'equipment.machine',
  other: 'equipment.other',
  'foam roll': 'equipment.foamRoll',
  kettlebells: 'equipment.kettlebells',
  dumbbell: 'equipment.dumbbell',
  cable: 'equipment.cable',
  barbell: 'equipment.barbell',
  bands: 'equipment.bands',
  'medicine ball': 'equipment.medicineBall',
  'exercise ball': 'equipment.exerciseBall',
  'e-z curl bar': 'equipment.ezBar',
})

/** Takip edilen 17 kas grubunda olmayan, ama kütüphanede yardımcı kas olarak geçen kaslar. */
const EXTRA_MUSCLE_LABEL: Readonly<Record<string, string>> = labels({
  'hip flexors': 'muscle.hipFlexors',
  obliques: 'muscle.obliques',
})

/** Veri anahtarı (İngilizce) → arayüz dilinde etiket. Tanınmayan değer (kullanıcının yazdığı özel kas) olduğu gibi döner. */
export function muscleLabel(muscle: string): string {
  if (Object.hasOwn(MUSCLE_LABEL, muscle)) return (MUSCLE_LABEL as Record<string, string>)[muscle]
  return Object.hasOwn(EXTRA_MUSCLE_LABEL, muscle) ? EXTRA_MUSCLE_LABEL[muscle] : muscle
}

/** Ekipman yoksa (null) "Ekipmansız"; tanınmayan değer olduğu gibi döner. */
export function equipmentLabel(equipment: string | null): string {
  if (!equipment) return t('equipment.none')
  return Object.hasOwn(EQUIPMENT_LABEL, equipment) ? EQUIPMENT_LABEL[equipment] : equipment
}
