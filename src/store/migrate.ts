import { defaultState, SCHEMA_VERSION, type State } from './schema.ts'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
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
    },
    routines: arr(raw.routines),
    week: isRecord(raw.week) ? (raw.week as State['week']) : base.week,
    workouts: arr(raw.workouts),
    active: isRecord(raw.active) ? (raw.active as unknown as State['active']) : null,
    bodyweight: arr(raw.bodyweight),
    customEx: arr(raw.customEx),
  }
}
