import type {
  BodyweightEntry,
  CustomExercise,
  ExCfg,
  MeasurementEntry,
  PastBlock,
  ProgressionMode,
  Routine,
  SetEntry,
  SideSet,
  StrengthGoal,
  TrainingBlock,
  Workout,
  WorkoutEntry,
} from './schema.ts'
import { clampDistanceSec, clampMeters, MAX_DISTANCE_M, MAX_DISTANCE_SEC } from '../lib/distance.ts'
import { cleanMeasure, hasMeasure, MEASURE_KEYS, type MeasureKey } from '../lib/measurements.ts'
import { clampWeeks, MAX_BLOCK_WEEKS, MAX_PAST_BLOCKS, MIN_BLOCK_WEEKS } from '../lib/block.ts'
import { clampSec, MAX_TIMED_SEC } from '../lib/timed.ts'

/**
 * Kayıt düzeyinde doğrulama ve onarım. Ham veri (localStorage ya da yedek dosyası) uygulamaya girmeden
 * önce buradan geçer; tek bir bozuk kayıt tüm uygulamayı çökertmesin diye.
 *
 * Politika:
 * - Onarılabilir alan nötr bir varsayılanla onarılır (eksik isteğe bağlı alan atılır, sayı sonlu değilse
 *   alan atılır ya da güvenli varsayılan konur).
 * - Kimliği ya da temel yapısı kullanılamaz kayıt ATILIR (kimliksiz antrenman, `entries` dizisi olmayan
 *   antrenman, `exId`'siz egzersiz, nesne olmayan set …).
 * - Geçerli veri bayt bayt aynı kalır: alan sırası korunur, olmayan alan eklenmez. Bilinmeyen alanlar atılır
 *   (ayarlardaki migrate de böyle çalışır).
 */

/** Kayıt türleri; rapordaki sayılar bu anahtarlarla tutulur. */
export const KINDS = [
  'root',
  'workout',
  'entry',
  'set',
  'active',
  'routine',
  'routineEx',
  'week',
  'bodyweight',
  'measurement',
  'customEx',
  'muscleFix',
  'goal',
  'block',
] as const
export type Kind = (typeof KINDS)[number]

export interface SanitizeReport {
  /** Atılan kayıt sayısı (türe göre). */
  dropped: Record<Kind, number>
  /** Onarılıp tutulan kayıt sayısı (türe göre, kayıt başına en çok bir). */
  repaired: Record<Kind, number>
}

const zero = (): Record<Kind, number> => Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>

export function emptyReport(): SanitizeReport {
  return { dropped: zero(), repaired: zero() }
}

/** `from` sayılarını `into`ya ekler. */
function addReport(into: SanitizeReport, from: SanitizeReport): void {
  for (const k of KINDS) {
    into.dropped[k] += from.dropped[k]
    into.repaired[k] += from.repaired[k]
  }
}

const sum = (c: Record<Kind, number>): number => KINDS.reduce((n, k) => n + c[k], 0)

export function droppedTotal(r: SanitizeReport): number {
  return sum(r.dropped)
}

export function repairedTotal(r: SanitizeReport): number {
  return sum(r.repaired)
}

/** İçe aktarma/yükleme mesajına eklenen ek: atılan kayıt yoksa boş metin. */
export function describeDropped(r: SanitizeReport): string {
  const n = droppedTotal(r)
  return n > 0 ? `${n} bozuk kayıt atlandı` : ''
}

// --- yardımcılar -------------------------------------------------------------------------------

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const BAD = Symbol('bad')
type Check = (v: unknown) => unknown

const finite: Check = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : BAD)
const nonNeg: Check = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : BAD)
const positiveNum: Check = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : BAD)
const bool: Check = (v) => (typeof v === 'boolean' ? v : BAD)
const str: Check = (v) => (typeof v === 'string' ? v : BAD)
const id: Check = (v) => (typeof v === 'string' && v.length > 0 ? v : BAD)
const intIn =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : BAD

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Gerçek bir takvim günü olan YYYY-MM-DD. */
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const m = DAY_RE.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}
const day: Check = (v) => (isDay(v) ? v : BAD)

/** Alan sırasını koruyarak yalnız bilinen ve geçerli alanları kopyalar; geçersiz alan `bad`e yazılır. */
function pick(src: Record<string, unknown>, checks: Record<string, Check>): { out: Record<string, unknown>; bad: boolean } {
  const out: Record<string, unknown> = {}
  let bad = false
  for (const key of Object.keys(src)) {
    const check = Object.hasOwn(checks, key) ? checks[key] : undefined
    if (!check) continue
    const v = check(src[key])
    if (v === BAD) bad = true
    else out[key] = v
  }
  return { out, bad }
}

/** Gerekli alan yoksa (eksik ya da geçersizdi) varsayılanı sona ekler; eklediyse true. */
function fill(out: Record<string, unknown>, key: string, value: unknown): boolean {
  if (Object.hasOwn(out, key)) return false
  out[key] = value
  return true
}

// --- antrenman ---------------------------------------------------------------------------------

/** Bir egzersizde saklanabilecek en çok set (ısınma ve dropset dahil); arayüz de bunu aşmaz. */
export const MAX_SETS = 100

function sanitizeSide(raw: unknown): SideSet | undefined {
  if (!isRecord(raw)) return undefined
  const { out, bad } = pick(raw, { r: nonNeg, done: bool })
  return !bad && Object.hasOwn(out, 'r') && Object.hasOwn(out, 'done') ? (out as unknown as SideSet) : undefined
}

const sides: Check = (v) => {
  if (!isRecord(v)) return BAD
  const L = sanitizeSide(v.L)
  const R = sanitizeSide(v.R)
  return L && R ? { L, R } : BAD
}

const SET_CHECKS: Record<string, Check> = {
  w: finite,
  r: nonNeg,
  m: nonNeg,
  // RIR 0-4 seçilir (4 = "4 ve üstü"); makul üst sınır 10.
  rir: (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 ? v : BAD),
  done: bool,
  warmup: bool,
  drop: bool,
  partial: bool,
  sides,
}

/** Nesne olmayan set null döner (atılır); aksi hâlde onarılmış set. */
function sanitizeSet(raw: unknown, rep: SanitizeReport): SetEntry | null {
  if (!isRecord(raw)) return null
  const { out, bad } = pick(raw, SET_CHECKS)
  let fixed = bad
  fixed = fill(out, 'w', 0) || fixed
  fixed = fill(out, 'r', 0) || fixed
  fixed = fill(out, 'done', false) || fixed
  if (fixed) rep.repaired.set++
  return out as unknown as SetEntry
}

const ENTRY_CHECKS: Record<string, Check> = {
  exId: id,
  unilateral: bool,
  linked: bool,
  bw: bool,
  timed: bool,
  distance: bool,
  bwKg: positiveNum,
  note: str,
  restSec: positiveNum,
}

/** Süreli girdide saniyeyi 0-3600'e çeker (tek taraflıda iki taraf da); sınırı aşan set varsa true. */
function clampTimedSets(sets: SetEntry[]): boolean {
  let changed = false
  for (const s of sets) {
    if (s.r > MAX_TIMED_SEC || !Number.isInteger(s.r)) {
      s.r = clampSec(s.r)
      changed = true
    }
    if (!s.sides) continue
    for (const side of [s.sides.L, s.sides.R]) {
      if (side.r > MAX_TIMED_SEC || !Number.isInteger(side.r)) {
        side.r = clampSec(side.r)
        changed = true
      }
    }
  }
  return changed
}

/**
 * Mesafe girdisinde mesafeyi 0-1.000.000 m, süreyi 0-86.400 sn tam sayıya çeker; değişen set varsa true.
 * Mesafe girdisi olmayan setteki `m` anlamsızdır ve atılır (o da onarım sayılır).
 */
function fixDistanceSets(sets: SetEntry[], distance: boolean): boolean {
  let changed = false
  for (const s of sets) {
    if (!distance) {
      if (Object.hasOwn(s, 'm')) {
        delete s.m
        changed = true
      }
      continue
    }
    if (s.m !== undefined && (s.m > MAX_DISTANCE_M || !Number.isInteger(s.m))) {
      s.m = clampMeters(s.m)
      changed = true
    }
    if (s.r > MAX_DISTANCE_SEC || !Number.isInteger(s.r)) {
      s.r = clampDistanceSec(s.r)
      changed = true
    }
  }
  return changed
}

function sanitizeEntry(raw: unknown, rep: SanitizeReport): WorkoutEntry | null {
  if (!isRecord(raw) || typeof raw.exId !== 'string' || raw.exId.length === 0) return null
  const { out, bad } = pick(raw, {
    ...ENTRY_CHECKS,
    sets: (v) => (Array.isArray(v) ? v : BAD),
  })
  let fixed = bad
  const rawSets = Array.isArray(raw.sets) ? raw.sets : []
  const sets: SetEntry[] = []
  for (const s of rawSets.slice(0, MAX_SETS)) {
    const clean = sanitizeSet(s, rep)
    if (clean) sets.push(clean)
    else rep.dropped.set++
  }
  rep.dropped.set += Math.max(0, rawSets.length - MAX_SETS)
  // Mesafe ve süreli birlikte olamaz (`r` ya setin süresi ya tutuştur); daha çok veri taşıyan mesafe kalır.
  if (out.distance === true && Object.hasOwn(out, 'timed')) {
    delete out.timed
    fixed = true
  }
  if (out.timed === true && clampTimedSets(sets)) fixed = true
  if (fixDistanceSets(sets, out.distance === true)) fixed = true
  if (Object.hasOwn(out, 'sets')) out.sets = sets
  else {
    out.sets = []
    fixed = true
  }
  if (fixed) rep.repaired.entry++
  return out as unknown as WorkoutEntry
}

const WORKOUT_CHECKS: Record<string, Check> = {
  id,
  d: day,
  start: finite,
  end: finite,
  routineId: str,
  name: str,
  note: str,
}

/**
 * Antrenmanı doğrular. Kimlik, gün, başlangıç ya da `entries` dizisi kullanılamazsa null (atılır).
 */
function sanitizeWorkout(raw: unknown, rep: SanitizeReport): Workout | null {
  if (!isRecord(raw)) return null
  if (id(raw.id) === BAD || !isDay(raw.d) || finite(raw.start) === BAD || !Array.isArray(raw.entries)) {
    return null
  }
  // Alt kayıt sayıları yalnız antrenman tutulursa rapora girer; atılan antrenman tek kayıt sayılır.
  const sub = emptyReport()
  const { out, bad } = pick(raw, { ...WORKOUT_CHECKS, entries: () => [] })
  const entries: WorkoutEntry[] = []
  for (const e of raw.entries) {
    const clean = sanitizeEntry(e, sub)
    if (clean) entries.push(clean)
    else sub.dropped.entry++
  }
  // Egzersizleri vardı ama hiçbiri kullanılamadı: boş kabuk tutmanın anlamı yok. Baştan boş olan antrenman
  // (`entries: []`) geçerli şekildir ve aynen kalır.
  if (entries.length === 0 && raw.entries.length > 0) return null
  let fixed = bad
  fixed = fill(out, 'name', 'Antrenman') || fixed
  out.entries = entries
  if (fixed) sub.repaired.workout++
  addReport(rep, sub)
  return out as unknown as Workout
}

// --- rutin -------------------------------------------------------------------------------------

const PROG: ReadonlySet<unknown> = new Set<ProgressionMode>(['off', 'linear', 'double'])

const EXCFG_CHECKS: Record<string, Check> = {
  exId: id,
  sets: intIn(1, MAX_SETS),
  reps: nonNeg,
  weight: finite,
  prog: (v) => (PROG.has(v) ? v : BAD),
  side: bool,
  warmups: intIn(0, 4),
  drops: intIn(0, 3),
  superset: bool,
  bw: bool,
  timed: bool,
  distance: bool,
  meters: nonNeg,
  inc: nonNeg,
  repsMax: nonNeg,
  restSec: positiveNum,
}

function sanitizeExCfg(raw: unknown, rep: SanitizeReport): ExCfg | null {
  if (!isRecord(raw) || typeof raw.exId !== 'string' || raw.exId.length === 0) return null
  const { out, bad } = pick(raw, EXCFG_CHECKS)
  let fixed = bad
  fixed = fill(out, 'sets', 3) || fixed
  fixed = fill(out, 'reps', 8) || fixed
  fixed = fill(out, 'weight', 0) || fixed
  fixed = fill(out, 'prog', 'off') || fixed
  fixed = fill(out, 'inc', 0) || fixed
  fixed = fill(out, 'repsMax', out.reps) || fixed
  // Süreli egzersizde hedef saniyedir (0-3600). Mesafe bayrağı da varsa süreli aşağıda atılır.
  if (out.timed === true && out.distance !== true) {
    for (const key of ['reps', 'repsMax'] as const) {
      const sec = out[key] as number
      if (sec > MAX_TIMED_SEC || !Number.isInteger(sec)) {
        out[key] = clampSec(sec)
        fixed = true
      }
    }
  }
  // Mesafe egzersizinde hedef süre saniyedir (0-86.400), hedef mesafe metredir; başka egzersizde mesafe yok.
  if (out.distance === true) {
    if (Object.hasOwn(out, 'timed')) {
      delete out.timed
      fixed = true
    }
    for (const key of ['reps', 'repsMax'] as const) {
      const sec = out[key] as number
      if (sec > MAX_DISTANCE_SEC || !Number.isInteger(sec)) {
        out[key] = clampDistanceSec(sec)
        fixed = true
      }
    }
    if (typeof out.meters === 'number' && (out.meters > MAX_DISTANCE_M || !Number.isInteger(out.meters))) {
      out.meters = clampMeters(out.meters)
      fixed = true
    }
  } else if (Object.hasOwn(out, 'meters')) {
    delete out.meters
    fixed = true
  }
  if (fixed) rep.repaired.routineEx++
  return out as unknown as ExCfg
}

function sanitizeRoutine(raw: unknown, rep: SanitizeReport): Routine | null {
  if (!isRecord(raw) || !Array.isArray(raw.ex) || id(raw.id) === BAD || str(raw.name) === BAD) return null
  const sub = emptyReport()
  const { out } = pick(raw, { id, name: str, ex: () => [] })
  const ex: ExCfg[] = []
  for (const c of raw.ex) {
    const clean = sanitizeExCfg(c, sub)
    if (clean) ex.push(clean)
    else sub.dropped.routineEx++
  }
  out.ex = ex
  addReport(rep, sub)
  return out as unknown as Routine
}

// --- diğer kayıtlar ----------------------------------------------------------------------------

function sanitizeBodyweight(raw: unknown): BodyweightEntry | null {
  if (!isRecord(raw)) return null
  const { out } = pick(raw, { d: day, w: positiveNum })
  return Object.hasOwn(out, 'd') && Object.hasOwn(out, 'w') ? (out as unknown as BodyweightEntry) : null
}

const MEASURE_SET: ReadonlySet<string> = new Set(MEASURE_KEYS)

/**
 * Ölçü kaydı: gün gerekli, ölçüler isteğe bağlı. Geçersiz ölçü alanı atılır, fazla ondalık bire yuvarlanır
 * (ikisi de onarım sayılır). Geçerli günü ya da hiç geçerli ölçüsü kalmayan kayıt atılır.
 */
function sanitizeMeasurement(raw: unknown, rep: SanitizeReport): MeasurementEntry | null {
  if (!isRecord(raw) || !isDay(raw.d)) return null
  const out: Record<string, unknown> = {}
  let fixed = false
  for (const key of Object.keys(raw)) {
    if (key === 'd') out.d = raw.d
    else if (MEASURE_SET.has(key)) {
      const v = cleanMeasure(key as MeasureKey, raw[key])
      if (v !== raw[key]) fixed = true
      if (v !== undefined) out[key] = v
    }
  }
  if (!hasMeasure(out)) return null
  if (fixed) rep.repaired.measurement++
  return out as unknown as MeasurementEntry
}

function sanitizeCustom(raw: unknown, rep: SanitizeReport): CustomExercise | null {
  if (!isRecord(raw) || id(raw.id) === BAD || str(raw.name) === BAD) return null
  const { out, bad } = pick(raw, {
    id,
    name: str,
    primaryMuscles: (v) => (Array.isArray(v) ? v.filter((m) => typeof m === 'string') : BAD),
    equipment: str,
  })
  let fixed = bad
  fixed = fill(out, 'primaryMuscles', []) || fixed
  fixed = fill(out, 'equipment', '') || fixed
  if (fixed) rep.repaired.customEx++
  return out as unknown as CustomExercise
}

/** Hedef 1RM'in makul üst sınırı (kg); üstü yazım hatası sayılır. */
export const MAX_GOAL_KG = 1000

/** Kimlik, egzersiz, hedef, hedef gün ve oluşturma günü zorunludur; biri kullanılamazsa hedef atılır. */
function sanitizeGoal(raw: unknown): StrengthGoal | null {
  if (!isRecord(raw)) return null
  const { out } = pick(raw, {
    id,
    exId: id,
    target: (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_GOAL_KG ? v : BAD),
    by: day,
    created: day,
    done: day,
  })
  return ['id', 'exId', 'target', 'by', 'created'].every((k) => Object.hasOwn(out, k))
    ? (out as unknown as StrengthGoal)
    : null
}

// --- blok --------------------------------------------------------------------------------------

const BLOCK_CHECKS: Record<string, Check> = {
  id,
  start: day,
  weeks: intIn(MIN_BLOCK_WEEKS, MAX_BLOCK_WEEKS),
  deload: intIn(1, MAX_BLOCK_WEEKS),
}

const OUTCOMES: ReadonlySet<unknown> = new Set<PastBlock['outcome']>(['done', 'cancelled'])

/**
 * Bloğu doğrular. Kimlik ya da başlangıç günü kullanılamazsa null (atılır); `past` iken bitiş günü de
 * zorunludur. Hafta sayısı aralık dışındaysa 4-6'ya çekilir, deload haftası blok dışındaysa son haftaya
 * alınır, geçmişteki bloğun sonucu bilinmiyorsa "bitti" sayılır.
 */
function sanitizeBlock(raw: unknown, rep: SanitizeReport, past: boolean): Record<string, unknown> | null {
  if (!isRecord(raw) || id(raw.id) === BAD || !isDay(raw.start)) return null
  if (past && !isDay(raw.end)) return null
  const checks: Record<string, Check> = past
    ? { ...BLOCK_CHECKS, end: day, outcome: (v) => (OUTCOMES.has(v) ? v : BAD) }
    : BLOCK_CHECKS
  const { out, bad } = pick(raw, checks)
  let fixed = bad
  fixed = fill(out, 'weeks', clampWeeks(raw.weeks)) || fixed
  fixed = fill(out, 'deload', out.weeks) || fixed
  if ((out.deload as number) > (out.weeks as number)) {
    out.deload = out.weeks
    fixed = true
  }
  if (past) fixed = fill(out, 'outcome', 'done') || fixed
  if (fixed) rep.repaired.block++
  return out
}

/** Gün (0-6) → rutin kimliği; geçersiz çiftler atılır. */
function sanitizeWeek(raw: Record<string, unknown>, rep: SanitizeReport): Record<number, string> {
  const week: Record<number, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(k)
    if (/^[0-6]$/.test(k) && Number.isInteger(n) && id(v) !== BAD) week[n] = v as string
    else rep.dropped.week++
  }
  return week
}

/** Dizi alanı: yoksa boş ve sessiz; dizi değilse boş ve 1 atılmış sayılır. */
function list<T>(raw: Record<string, unknown>, key: string, kind: Kind, rep: SanitizeReport, one: (v: unknown) => T | null): T[] {
  const v = raw[key]
  if (v === undefined) return []
  if (!Array.isArray(v)) {
    rep.dropped[kind]++
    return []
  }
  const out: T[] = []
  for (const item of v) {
    const clean = one(item)
    if (clean) out.push(clean)
    else rep.dropped[kind]++
  }
  return out
}

/** `migrate`in kayıt alanları: ayarlar dışındaki her şey. `muscleFix` migrate'te işlenir. */
export function sanitizeRecords(raw: Record<string, unknown>, rep: SanitizeReport) {
  const routines = list(raw, 'routines', 'routine', rep, (v) => sanitizeRoutine(v, rep))
  const workouts = list(raw, 'workouts', 'workout', rep, (v) => sanitizeWorkout(v, rep))
  const bodyweight = list(raw, 'bodyweight', 'bodyweight', rep, sanitizeBodyweight)
  const measurements = list(raw, 'measurements', 'measurement', rep, (v) => sanitizeMeasurement(v, rep))
  const customEx = list(raw, 'customEx', 'customEx', rep, (v) => sanitizeCustom(v, rep))
  const goals = list(raw, 'goals', 'goal', rep, sanitizeGoal)

  let week: Record<number, string> = {}
  if (isRecord(raw.week)) week = sanitizeWeek(raw.week, rep)
  else if (raw.week !== undefined) rep.dropped.week++

  let active: Workout | null = null
  if (raw.active !== undefined && raw.active !== null) {
    active = sanitizeWorkout(raw.active, rep)
    if (!active) rep.dropped.active++
  }

  let block: TrainingBlock | null = null
  if (raw.block !== undefined && raw.block !== null) {
    block = sanitizeBlock(raw.block, rep, false) as TrainingBlock | null
    if (!block) rep.dropped.block++
  }
  const allPast = list(raw, 'pastBlocks', 'block', rep, (v) => sanitizeBlock(v, rep, true) as PastBlock | null)
  // Uygulama geçmişi MAX_PAST_BLOCKS'ta tutar; fazlası (elle düzenlenmiş yedek) en eskiden atılır.
  rep.dropped.block += Math.max(0, allPast.length - MAX_PAST_BLOCKS)
  const pastBlocks = allPast.slice(-MAX_PAST_BLOCKS)

  return { routines, week, workouts, active, bodyweight, measurements, customEx, goals, block, pastBlocks }
}
