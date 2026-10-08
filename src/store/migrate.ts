import { DEFAULT_KITS, type PlateKit } from '../lib/plates.ts'
import type { Unit } from '../lib/units.ts'
import { defaultState, SCHEMA_VERSION, type State } from './schema.ts'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

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

/**
 * Kayıtlı veya içe aktarılan ham veriyi geçerli State'e çevirir.
 * Eksik alanlar varsayılanlarla tamamlanır, bozuk alanlar atılır; uygulama asla çökmez.
 */
export function migrate(raw: unknown): State {
  const base = defaultState()
  if (!isRecord(raw)) return base

  const settings = isRecord(raw.settings) ? raw.settings : {}
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

  return {
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
    },
    routines: arr(raw.routines),
    week: isRecord(raw.week) ? (raw.week as State['week']) : base.week,
    workouts: arr(raw.workouts),
    active: isRecord(raw.active) ? (raw.active as unknown as State['active']) : null,
    bodyweight: arr(raw.bodyweight),
    customEx: arr(raw.customEx),
  }
}
