import type { Unit } from './units.ts'

/** İçe aktarılabilen uygulama biçimleri. */
export type ImportFormat = 'strong' | 'hevy'

export interface ImportedSet {
  type: 'normal' | 'warmup' | 'drop'
  /** Dosyadaki ağırlık, dosyanın kendi biriminde (kg'a çevrilmemiş). */
  weight: number
  reps: number
}

export interface ImportedEntry {
  /** Dosyadaki egzersiz adı, olduğu gibi (kırpılmış). */
  name: string
  /** Hevy: aynı değeri taşıyan ardışık egzersizler bir süpersettir. */
  supersetId?: string
  sets: ImportedSet[]
}

export interface ImportedWorkout {
  name: string
  /** Yerel saatle başlangıç, epoch ms. */
  start: number
  /** Yerel gün, YYYY-MM-DD. */
  date: string
  durationSec?: number
  entries: ImportedEntry[]
}

export interface ParsedImport {
  format: ImportFormat
  /** Dosya birimi söylüyorsa o; söylemiyorsa (eski Strong "Weight") null. */
  unit: Unit | null
  /** Başlangıç zamanına göre eskiden yeniye sıralı. */
  workouts: ImportedWorkout[]
  /** Atlanan satır sayısı (süre/mesafe tabanlı, tekrarı olmayan, dinlenme sayacı vb.). */
  skippedRows: number
  /** Kullanıcıya gösterilecek Türkçe uyarılar. */
  warnings: string[]
}
