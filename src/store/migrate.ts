import { normalizeMuscleFix } from '../lib/muscleFix.ts'
import { cleanTarget, MUSCLES, type MuscleTargets } from '../lib/muscles.ts'
import { DEFAULT_KITS, type PlateKit } from '../lib/plates.ts'
import type { Unit } from '../lib/units.ts'
import { emptyReport, isRecord, sanitizeRecords, type SanitizeReport } from './sanitize.ts'
import { defaultState, SCHEMA_VERSION, type State } from './schema.ts'

/** Pozitif, sonlu sayı; değilse undefined (bozuk yedek alanı atılır). */
function positive(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

const MAX_BAR = 100
const MAX_PLATE = 100

/** Bozuk bar/plaka değerlerini atar; geçerli plakalar tekilleşir ve ağırdan hafife sıralanır. */
function migrateKit(raw: unknown, unit: Unit): PlateKit {
  const base = DEFAULT_KITS[unit]
  if (!isRecord(raw)) return { bar: base.bar, plates: [...base.plates] }
  const bar =
    typeof raw.bar === 'number' && Number.isFinite(raw.bar) && raw.bar >= 0 && raw.bar <= MAX_BAR
      ? raw.bar
      : base.bar
  const plates = Array.isArray(raw.plates)
    ? [
        ...new Set(
          raw.plates.filter(
            (p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0 && p <= MAX_PLATE,
          ),
        ),
      ].sort((a, b) => b - a)
    : [...base.plates]
  return { bar, plates }
}

/** Bozuk kas düzeltmelerini atar (atılan sayı rapora girer); geçerli olanlar temizlenir. `fromEntries` `__proto__` anahtarına karşı güvenlidir. */
function migrateMuscleFix(raw: unknown, rep: SanitizeReport): State['muscleFix'] {
  if (!isRecord(raw)) {
    if (raw !== undefined) rep.dropped.muscleFix++
    return {}
  }
  return Object.fromEntries(
    Object.entries(raw).flatMap(([id, v]) => {
      const fix = isRecord(v) ? normalizeMuscleFix(v) : undefined
      if (!fix) rep.dropped.muscleFix++
      return fix ? [[id, fix] as const] : []
    }),
  )
}

/**
 * Kas hedeflerinden yalnız bilinen kasların geçerli (0-40) değerlerini tutar; bozuk değerler ve bilinmeyen
 * anahtarlar atılır. Anahtarlar `MUSCLES` listesinden okunur, bu yüzden `__proto__` gibi anahtarlar sızamaz.
 * Hiç geçerli hedef kalmazsa undefined (varsayılanlar geçerli).
 */
function migrateMuscleTargets(raw: unknown): MuscleTargets | undefined {
  if (!isRecord(raw)) return undefined
  const out: MuscleTargets = {}
  for (const m of MUSCLES) {
    const v = Object.hasOwn(raw, m) ? cleanTarget(raw[m]) : undefined
    if (v !== undefined) out[m] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export interface MigrateResult {
  state: State
  /** Atılan ve onarılan kayıtların sayıları (bkz. sanitize.ts). */
  report: SanitizeReport
}

/** Raporsuz migrate: mevcut çağıranlar için. */
export function migrate(raw: unknown): State {
  return migrateWithReport(raw).state
}

/**
 * Kayıtlı veya içe aktarılan ham veriyi geçerli State'e çevirir.
 * Eksik alanlar varsayılanlarla tamamlanır, bozuk alanlar onarılır, kullanılamayan kayıtlar atılır;
 * uygulama asla çökmez. Ne atıldığını ve onarıldığını `report` söyler.
 */
export function migrateWithReport(raw: unknown): MigrateResult {
  const base = defaultState()
  const report = emptyReport()
  if (!isRecord(raw)) {
    report.dropped.root++
    return { state: base, report }
  }

  const settings = isRecord(raw.settings) ? raw.settings : {}
  // Hedefler ve blok alanları State'teki sırasıyla (kas düzeltmesinden sonra) yazılır: geçerli veri bayt
  // bayt aynı kalsın (defaultState ile aynı anahtar sırası).
  const { goals, block, pastBlocks, ...records } = sanitizeRecords(raw, report)

  const state: State = {
    version: SCHEMA_VERSION,
    settings: {
      unit: settings.unit === 'lb' ? 'lb' : 'kg',
      restSec:
        typeof settings.restSec === 'number' && settings.restSec > 0
          ? settings.restSec
          : base.settings.restSec,
      weekStart:
        typeof settings.weekStart === 'number' && settings.weekStart >= 0 && settings.weekStart <= 6
          ? settings.weekStart
          : base.settings.weekStart,
      plateKit: {
        kg: migrateKit(isRecord(settings.plateKit) ? settings.plateKit.kg : undefined, 'kg'),
        lb: migrateKit(isRecord(settings.plateKit) ? settings.plateKit.lb : undefined, 'lb'),
      },
      backupRemindDays:
        typeof settings.backupRemindDays === 'number' &&
        Number.isInteger(settings.backupRemindDays) &&
        settings.backupRemindDays >= 0 &&
        settings.backupRemindDays <= 365
          ? settings.backupRemindDays
          : base.settings.backupRemindDays,
      lastBackupAt: positive(settings.lastBackupAt),
      lastBackupHash:
        typeof settings.lastBackupHash === 'string' && settings.lastBackupHash.length <= 32
          ? settings.lastBackupHash
          : undefined,
      backupSnoozedUntil: positive(settings.backupSnoozedUntil),
      bodyweightGoal:
        typeof settings.bodyweightGoal === 'number' &&
        Number.isFinite(settings.bodyweightGoal) &&
        Math.abs(settings.bodyweightGoal) <= 2
          ? settings.bodyweightGoal
          : undefined,
      muscleTargets: migrateMuscleTargets(settings.muscleTargets),
      progressionRule: settings.progressionRule === 'fast' ? 'fast' : undefined,
      theme: settings.theme === 'dark' || settings.theme === 'light' ? settings.theme : 'system',
      language: settings.language === 'tr' || settings.language === 'en' ? settings.language : 'system',
      deloadSnoozedUntil: positive(settings.deloadSnoozedUntil),
    },
    ...records,
    muscleFix: migrateMuscleFix(raw.muscleFix, report),
    goals,
    block,
    pastBlocks,
  }
  return { state, report }
}
