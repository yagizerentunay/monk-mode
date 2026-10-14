import type { Unit } from './units.ts'

/** İçe aktarılabilen uygulama biçimleri. */
export type ImportFormat = 'strong' | 'hevy'

export interface ImportedSet {
  type: 'normal' | 'warmup' | 'drop'
  /** Dosyadaki ağırlık, dosyanın kendi biriminde (kg'a çevrilmemiş). */
  weight: number
  /** Tekrar; `timed` sette tutulan süre (sn, 1-3600). */
  reps: number
  /**
   * Süreli set: dosyada tekrar yok, set süresi var (Strong "Seconds", Hevy "duration_seconds"). Mesafeli
   * (kardiyo) satırlar süreli sayılmaz. Bir egzersizin setleri ya hep süreli ya hep tekrarlıdır.
   */
  timed?: true
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
  /** Atlanan satır sayısı (tekrarı ve set süresi olmayan, mesafeli, süreli/tekrarlı karışık egzersiz, dinlenme sayacı vb.). */
  skippedRows: number
  /** Kullanıcıya gösterilecek Türkçe uyarılar. */
  warnings: string[]
}
