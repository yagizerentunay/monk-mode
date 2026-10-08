import type { Settings, State } from '../store/schema.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export const REMIND_CHOICES = [0, 7, 14, 30] as const
/** "Sonra hatırlat" kaç gün susturur. */
export const SNOOZE_DAYS = 3

/** Yedeğe giren veri alanları; ayarlar ve devam eden antrenman (`active`) yedeğin parçası sayılmaz. */
type Backed = Pick<State, 'workouts' | 'routines' | 'week' | 'bodyweight' | 'customEx'>

/**
 * Verinin kısa parmak izi (cyrb53, 53 bit; kriptografik değil). "Yedekten sonra bir şey değişti mi"
 * sorusu için yeter: aynı veri aynı izi verir, bir antrenman eklemek/silmek izi değiştirir.
 */
export function fingerprint(data: Backed): string {
  const text = JSON.stringify([data.workouts, data.routines, data.week, data.bodyweight, data.customEx])
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export interface BackupStatus {
  /** Hatırlatma gösterilmeli mi. */
  due: boolean
  /** Son yedekten sonra veri değişti (ya da hiç yedek yok ve veri var). */
  dirty: boolean
  /** Hiç yedek alınmadı. */
  never: boolean
  /** Başvuru anından (son yedek; hiç yoksa en eski kayıt) bu yana tam gün; veri yoksa null. */
  days: number | null
}

function firstRecordAt(data: Backed): number | null {
  const times = [
    ...data.workouts.map((w) => w.start),
    ...data.bodyweight.map((b) => Date.parse(b.d)),
  ].filter((t) => Number.isFinite(t))
  return times.length > 0 ? Math.min(...times) : null
}

/**
 * Yedek hatırlatması gerekli mi: hatırlatma açık, saklanacak antrenman/kilo kaydı var, son yedekten
 * beri veri değişmiş, aradan en az `backupRemindDays` gün geçmiş ve ertelenmemiş. Hiç yedek yoksa
 * süre en eski kayıttan sayılır. Yalnız rutin kurulmuşsa (antrenman/kilo yok) hatırlatmaz.
 */
export function backupStatus(data: Backed & { settings: Settings }, now: number): BackupStatus {
  const { settings } = data
  const hasData = data.workouts.length > 0 || data.bodyweight.length > 0
  const never = settings.lastBackupAt === undefined
  const reference = settings.lastBackupAt ?? firstRecordAt(data)
  if (!hasData || reference === null) return { due: false, dirty: false, never, days: null }

  const dirty = fingerprint(data) !== settings.lastBackupHash
  const days = Math.max(0, Math.floor((now - reference) / DAY_MS))
  const snoozed = settings.backupSnoozedUntil !== undefined && now < settings.backupSnoozedUntil
  const due = settings.backupRemindDays > 0 && dirty && days >= settings.backupRemindDays && !snoozed
  return { due, dirty, never, days }
}
