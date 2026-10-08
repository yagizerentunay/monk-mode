import { DEFAULT_KITS, type PlateKit } from '../lib/plates.ts'
import type { Unit } from '../lib/units.ts'

export const SCHEMA_VERSION = 1

export type ProgressionMode = 'off' | 'linear' | 'double'

/** Rutindeki bir egzersizin planı. Ağırlıklar kg cinsindendir. */
export interface ExCfg {
  exId: string
  sets: number
  reps: number
  weight: number
  prog: ProgressionMode
  /** Tek taraflı egzersiz: sol ve sağ taraf ayrı kaydedilir, ağırlık taraf başınadır. */
  side?: boolean
  /** Seans başında otomatik eklenecek ısınma seti sayısı (0-4). */
  warmups?: number
  /** Son çalışma setinin ardından eklenecek dropset sayısı (0-3). */
  drops?: number
  /** Önceki egzersizle süperset: bağlı ardışık egzersizler bir turda dönüşümlü yapılır. */
  superset?: boolean
  /** Her başarılı seansta eklenecek kg. */
  inc: number
  /** Double progression için tekrar aralığının üst sınırı. */
  repsMax: number
  restSec?: number
}

export interface Routine {
  id: string
  name: string
  ex: ExCfg[]
}

/** Tek taraflı setin bir tarafı. */
export interface SideSet {
  r: number
  done: boolean
}

export interface SetEntry {
  w: number
  /** Tekrar. Tek taraflı sette taraf başına tekrardır: iki tarafın düşüğü (zayıf taraf belirler). */
  r: number
  rir?: number
  /** Tek taraflı sette iki taraf da tamamlanmışsa true. */
  done: boolean
  /** Isınma seti: hacim, ilerleme ve PR hesabına girmez, RIR tutulmaz. */
  warmup?: boolean
  /**
   * Dropset: önceki setin hemen ardından daha hafif ağırlıkla yapılan devam seti. Hacme ve geçmişe
   * girer ama ilerleme hesabında yok sayılır (hafif ve az tekrarlı olduğu için hedefi tutmaz).
   */
  drop?: boolean
  /**
   * Yarım set: tek taraflı sette yalnız bir taraf yapılmış, antrenman o hâlde bitmiş. Hacme girer ama
   * `done` değildir; bu yüzden ilerleme, 1RM ve PR hesabına karışmaz. Yapılmayan tarafın tekrarı 0'dır.
   */
  partial?: boolean
  /** Tek taraflı setlerde gerçek kaynak; `r` ve `done` buradan türetilir (bkz. lib/sets.ts). */
  sides?: { L: SideSet; R: SideSet }
}

export interface WorkoutEntry {
  exId: string
  sets: SetEntry[]
  /** Setler sol/sağ ayrı tutulur. */
  unilateral?: boolean
  /** Önceki egzersizle süperset; ilk egzersizde yok sayılır (bkz. lib/superset.ts). */
  linked?: boolean
  /** Kısa not (ağrı, takılma, enerji…); aynı egzersizin sonraki seansında hatırlatılır (lib/notes.ts). */
  note?: string
}

export interface Workout {
  id: string
  /** YYYY-MM-DD, yerel gün. */
  d: string
  start: number
  end?: number
  routineId?: string
  name: string
  entries: WorkoutEntry[]
  note?: string
}

export interface BodyweightEntry {
  d: string
  w: number
}

export interface CustomExercise {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string
}

export interface Settings {
  unit: Unit
  restSec: number
  /** 0 = Pazar … 6 = Cumartesi, Date.getDay() ile uyumlu. */
  weekStart: number
  /** Plaka hesaplayıcı için bar ve eldeki plakalar; her birimin kiti kendi biriminde tutulur. */
  plateKit: Record<Unit, PlateKit>
  /** Yedek hatırlatma aralığı (gün); 0 = kapalı. */
  backupRemindDays: number
  /** Son yedeğin zamanı (epoch ms) ve o andaki verinin parmak izi (bkz. lib/backupReminder.ts). */
  lastBackupAt?: number
  lastBackupHash?: string
  /** "Sonra hatırlat" ile ertelendiyse bu zamana (epoch ms) kadar hatırlatma yok. */
  backupSnoozedUntil?: number
  /** Hedef vücut ağırlığı değişim hızı, kg/hafta (+ kilo alma, − verme, 0 koruma); yoksa hedef yok. */
  bodyweightGoal?: number
}

export interface State {
  version: number
  settings: Settings
  routines: Routine[]
  /** Haftanın günü (0-6) → rutin kimliği. */
  week: Record<number, string>
  workouts: Workout[]
  active: Workout | null
  bodyweight: BodyweightEntry[]
  customEx: CustomExercise[]
}

export function defaultState(): State {
  return {
    version: SCHEMA_VERSION,
    settings: { unit: 'kg', restSec: 90, weekStart: 1, plateKit: structuredClone(DEFAULT_KITS), backupRemindDays: 14 },
    routines: [],
    week: {},
    workouts: [],
    active: null,
    bodyweight: [],
    customEx: [],
  }
}
