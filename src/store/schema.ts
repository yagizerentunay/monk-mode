import type { MuscleFix } from '../lib/muscleFix.ts'
import type { MuscleTargets } from '../lib/muscles.ts'
import { DEFAULT_KITS, type PlateKit } from '../lib/plates.ts'
import type { Unit } from '../lib/units.ts'

export const SCHEMA_VERSION = 1

export type ProgressionMode = 'off' | 'linear' | 'double'

export type ProgressionRule = 'cautious' | 'fast'

/** Görünüm: 'system' cihazın açık/koyu tercihini izler (bkz. lib/theme.ts). */
export type Theme = 'system' | 'dark' | 'light'

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
  /** Vücut ağırlığı egzersizi: setlerdeki ağırlık ek yüktür (negatif = asist), toplam yük vücut ağırlığını içerir. */
  bw?: boolean
  /**
   * Süreli egzersiz (plank, izometrik, asılı kalma…). Tasarım: ayrı süre alanları yerine mevcut `reps` ve
   * `repsMax` saniye olarak okunur (bkz. lib/timed.ts); böylece set sayısı, hedef aralığı ve ilerleme
   * mantığı aynen çalışır. Hedef süre 1-3600 sn; açıldığında varsayılan 30 sn.
   */
  timed?: boolean
  /** Her başarılı seansta eklenecek kg. */
  inc: number
  /** Double progression için tekrar aralığının üst sınırı. */
  repsMax: number
  /** Bu egzersize özel dinlenme süresi (sn); yoksa Ayarlar'daki süre geçerlidir. */
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
  /**
   * Tekrar. Tek taraflı sette taraf başına tekrardır: iki tarafın düşüğü (zayıf taraf belirler).
   * Süreli girdide (`WorkoutEntry.timed`) tekrar değil tutulan saniyedir; tek taraflıda da aynı kural
   * geçerlidir (sol/sağ saniye, `r` düşüğü). Hacim ve 1RM süreli girdiyi hiç görmez (bkz. lib/timed.ts).
   */
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
  /** Vücut ağırlığı egzersizi: `w` ek yüktür (negatif = asist); toplam yük `bwKg + w`. Yoksa `w` mutlak yüktür. */
  bw?: boolean
  /** Seans kurulurken geçerli vücut ağırlığı (kg); sonradan değişse de geçmiş hesapları kaymaz. Kayıt yoksa tanımsız. */
  bwKg?: number
  /** Süreli egzersiz: `SetEntry.r` ve `SideSet.r` saniyedir; hacim, 1RM ve plato/deload hesabına girmez (bkz. lib/timed.ts). */
  timed?: boolean
  /** Kısa not (ağrı, takılma, enerji…); aynı egzersizin sonraki seansında hatırlatılır (lib/notes.ts). */
  note?: string
  /** Bu egzersize özel dinlenme süresi (sn); rutindeki `ExCfg.restSec`'ten gelir, yoksa ayardaki süre geçerlidir. */
  restSec?: number
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

/**
 * Bir günün vücut ölçüleri. Çevreler cm, yağ oranı yüzdedir; alanlar isteğe bağlıdır ama en az biri
 * bulunur (bkz. lib/measurements.ts). Birim ayarı (kg/lb) ölçülere uygulanmaz.
 */
export interface MeasurementEntry {
  d: string
  waist?: number
  chest?: number
  arm?: number
  hip?: number
  fat?: number
}

export interface CustomExercise {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string
}

/**
 * Kuvvet hedefi: bir egzersizde belli bir güne kadar ulaşılacak tahmini 1RM (bkz. lib/goals.ts).
 * Ağırlık kg tutulur; birim yalnız gösterimde uygulanır.
 */
export interface StrengthGoal {
  id: string
  exId: string
  /** Hedef tahmini 1RM (kg). */
  target: number
  /** Hedef gün, YYYY-MM-DD. */
  by: string
  /** Hedefin oluşturulduğu gün, YYYY-MM-DD; ulaşma bu günden itibaren yapılan seanslara bakar. */
  created: string
  /** Hedefe ulaşılan gün; ulaşılmadıysa yok. Kutlama yalnız bu alan ilk kez yazılırken gösterilir. */
  done?: string
}

/**
 * Antrenman bloğu (mezosiklus): 4–6 haftalık plan, içinde bir planlı deload haftası (bkz. lib/block.ts).
 * Haftalar takvim haftasıdır (`Settings.weekStart`'a göre): 1. hafta, `start` gününün haftasıdır.
 */
export interface TrainingBlock {
  id: string
  /** YYYY-MM-DD, yerel gün. */
  start: string
  /** Hafta sayısı (4-6). */
  weeks: number
  /** Planlı deload haftası (1..weeks); varsayılan son hafta. */
  deload: number
}

/** Bitirilmiş ya da iptal edilmiş blok: kısa geçmiş için saklanır. */
export interface PastBlock extends TrainingBlock {
  /** YYYY-MM-DD, bitirildiği ya da iptal edildiği yerel gün. */
  end: string
  outcome: 'done' | 'cancelled'
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
  /**
   * Kas → haftalık hedef set (0-40, 0 = hedef yok). Yoksa her kas için varsayılan 10 geçerlidir.
   * Kesin bilimsel hedef değil, ayarlanabilir bir kılavuzdur (bkz. lib/muscles.ts).
   */
  muscleTargets?: MuscleTargets
  /**
   * Ağırlık artırma kuralı (bkz. lib/progression.ts). 'cautious' (varsayılan, yoksa da bu): üst tekrar
   * sınırında iki ardışık seans ve RIR ≥ 2. 'fast': tek seans yeter, RIR'e bakılmaz (eski davranış).
   */
  progressionRule?: ProgressionRule
  /** Deload önerisi "Şimdi değil" ile ertelendiyse bu zamana (epoch ms) kadar gösterilmez (bkz. lib/deload.ts). */
  deloadSnoozedUntil?: number
  /** Renk teması; varsayılan 'system'. */
  theme: Theme
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
  /** Vücut ölçüleri, tarih sırasında; her güne en çok bir kayıt. */
  measurements: MeasurementEntry[]
  customEx: CustomExercise[]
  /** Egzersiz kimliği → kullanıcının kas düzeltmesi (bkz. lib/muscleFix.ts); yoksa kütüphane verisi geçerli. */
  muscleFix: Record<string, MuscleFix>
  /** Kuvvet hedefleri, eklenme sırasında. */
  goals: StrengthGoal[]
  /** Süren antrenman bloğu; yoksa null. */
  block: TrainingBlock | null
  /** Biten ve iptal edilen bloklar, bitişe göre eski→yeni (en çok MAX_PAST_BLOCKS, bkz. lib/block.ts). */
  pastBlocks: PastBlock[]
}

export function defaultState(): State {
  return {
    version: SCHEMA_VERSION,
    settings: { unit: 'kg', restSec: 90, weekStart: 1, plateKit: structuredClone(DEFAULT_KITS), backupRemindDays: 14, theme: 'system' },
    routines: [],
    week: {},
    workouts: [],
    active: null,
    bodyweight: [],
    measurements: [],
    customEx: [],
    muscleFix: {},
    goals: [],
    block: null,
    pastBlocks: [],
  }
}
