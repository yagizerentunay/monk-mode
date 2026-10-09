import type { CustomExercise, ExCfg, ProgressionMode, Routine } from '../store/schema.ts'
import { MAX_DROPS, MAX_WARMUPS } from './intensity.ts'

const PROGRESSIONS: readonly ProgressionMode[] = ['off', 'linear', 'double']

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown, fallback: number, min: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback

function sanitizeEx(raw: unknown): ExCfg | null {
  if (!isRecord(raw) || typeof raw.exId !== 'string' || raw.exId === '') return null
  const reps = Math.round(num(raw.reps, 8, 1))
  const bw = raw.bw === true
  const cfg: ExCfg = {
    exId: raw.exId,
    sets: Math.round(num(raw.sets, 3, 1)),
    reps,
    // Vücut ağırlığı egzersizinde ağırlık ek yüktür: negatif (asist) geçerlidir.
    weight: num(raw.weight, 0, bw ? -Infinity : 0),
    prog: PROGRESSIONS.includes(raw.prog as ProgressionMode) ? (raw.prog as ProgressionMode) : 'double',
    inc: num(raw.inc, 2.5, 0),
    repsMax: Math.max(reps, Math.round(num(raw.repsMax, 12, 1))),
  }
  if (raw.side === true) cfg.side = true
  if (raw.superset === true) cfg.superset = true
  if (bw) cfg.bw = true
  if (typeof raw.warmups === 'number') cfg.warmups = Math.min(MAX_WARMUPS, Math.max(0, Math.round(raw.warmups)))
  if (typeof raw.drops === 'number') cfg.drops = Math.min(MAX_DROPS, Math.max(0, Math.round(raw.drops)))
  if (typeof raw.restSec === 'number' && raw.restSec > 0) cfg.restSec = raw.restSec
  return cfg
}

/** Dışarıdan gelen ham rutini doğrular; geçersizse null. Eksik sayılar varsayılanla tamamlanır. */
export function sanitizeRoutine(raw: unknown): Routine | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '' || typeof raw.name !== 'string') return null
  if (!Array.isArray(raw.ex)) return null
  const ex = raw.ex.map(sanitizeEx).filter((e): e is ExCfg => e !== null)
  if (ex.length === 0) return null
  return { id: raw.id, name: raw.name.trim() || 'Rutin', ex }
}

export interface RoutineMerge {
  routines: Routine[]
  customEx: CustomExercise[]
  added: number
  /** Aynı kimlikle zaten kayıtlı olduğu için atlanan rutinler. */
  skipped: number
  /** Geçersiz biçimli olduğu için atlanan rutinler. */
  invalid: number
}

/**
 * Bir yedek dosyasındaki rutinleri mevcut verinin ÜSTÜNE ekler; antrenman, ayar ve haftalık programa
 * dokunmaz. Aynı kimlikli rutin atlanır (aynı dosyayı iki kez yüklemek çoğaltmaz); aynı ada sahip
 * farklı kimlikli rutin "(2)" ekiyle eklenir. Yalnız eklenen rutinlerin kullandığı özel egzersizler
 * alınır.
 */
export function mergeRoutines(
  have: { routines: readonly Routine[]; customEx: readonly CustomExercise[] },
  incoming: { routines: unknown; customEx: unknown },
): RoutineMerge {
  const ids = new Set(have.routines.map((r) => r.id))
  const names = new Set(have.routines.map((r) => r.name.trim().toLowerCase()))
  const routines = [...have.routines]
  let added = 0
  let skipped = 0
  let invalid = 0
  const used = new Set<string>()

  for (const raw of Array.isArray(incoming.routines) ? incoming.routines : []) {
    const r = sanitizeRoutine(raw)
    if (!r) {
      invalid++
      continue
    }
    if (ids.has(r.id)) {
      skipped++
      continue
    }
    let name = r.name
    for (let n = 2; names.has(name.trim().toLowerCase()); n++) name = `${r.name} (${n})`
    ids.add(r.id)
    names.add(name.trim().toLowerCase())
    routines.push({ ...r, name })
    for (const e of r.ex) used.add(e.exId)
    added++
  }

  const haveCustom = new Set(have.customEx.map((c) => c.id))
  const customEx = [...have.customEx]
  for (const raw of Array.isArray(incoming.customEx) ? incoming.customEx : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') continue
    if (!used.has(raw.id) || haveCustom.has(raw.id)) continue
    haveCustom.add(raw.id)
    customEx.push({
      id: raw.id,
      name: raw.name,
      primaryMuscles: Array.isArray(raw.primaryMuscles)
        ? raw.primaryMuscles.filter((m): m is string => typeof m === 'string')
        : [],
      equipment: typeof raw.equipment === 'string' ? raw.equipment : '',
    })
  }

  return { routines, customEx, added, skipped, invalid }
}
