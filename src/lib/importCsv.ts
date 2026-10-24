import { t } from '../i18n/index.ts'
import type { Unit } from './units.ts'
import type { DistanceUnit, ImportedEntry, ImportedSet, ImportedWorkout, ParsedImport } from './importTypes.ts'
import { clampDistanceSec } from './distance.ts'
import { clampSec } from './timed.ts'

const DELIMITERS = [',', ';', '\t'] as const

/** Başlık satırında (tırnak dışında) en çok geçen ayırıcıyı seçer; hiçbiri yoksa virgül. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') {
        if (i > 0) break
      } else if (ch in counts) {
        counts[ch]++
      }
    }
  }
  let best = ','
  for (const d of DELIMITERS) {
    if (counts[d] > counts[best]) best = d
  }
  return best
}

/** RFC 4180 CSV ayrıştırıcı. Hücreler kırpılmaz. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const delim = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0
  const endRow = () => {
    row.push(cell)
    rows.push(row)
    row = []
    cell = ''
  }
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        cell += ch
      }
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\r') {
      endRow()
      if (text[i + 1] === '\n') i++
    } else if (ch === '\n') {
      endRow()
    } else {
      cell += ch
    }
    i++
  }
  // Son satır yeni satırla bitmediyse açık kalan hücreyi kapat.
  if (cell !== '' || row.length > 0) endRow()
  while (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') rows.pop()
    else break
  }
  return rows
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Hevy tarihleri uygulama dilinde yazılabilir ("1 Eki 2026"); Türkçe ilk üç harf (mar ve may ortak).
  oca: 1, şub: 2, nis: 4, haz: 6, tem: 7, ağu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
}

interface ParsedDate {
  /** Yerel saat, epoch ms. */
  ms: number
  /** YYYY-MM-DD. */
  date: string
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function build(y: number, mo: number, d: number, h: number, mi: number, s: number): ParsedDate | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  const ms = new Date(y, mo - 1, d, h, mi, s).getTime()
  if (Number.isNaN(ms)) return null
  // Tarihi UTC'den geçirmeden doğrudan dizgeden üretir.
  return { ms, date: `${pad(y, 4)}-${pad(mo)}-${pad(d)}` }
}

/** "2025-04-29 12:00:00", "2025-04-29T12:00", "2025-04-29"; sondaki saat dilimi yok sayılır. */
function parseIsoLocal(raw: string): ParsedDate | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw.trim())
  if (!m) return null
  return build(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
}

/** "26 Mar 2024, 17:26" (kısa/uzun İngilizce ay, saniye isteğe bağlı) ya da ISO. */
function parseHevyDate(raw: string): ParsedDate | null {
  const s = raw.trim()
  const m = /^(\d{1,2})\s+(\p{L}+)\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/u.exec(s)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!mo) return null
    return build(+m[3], mo, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
  }
  return parseIsoLocal(s)
}

/** "1h 15m", "45m", "30s" ya da (başlık "sec" ise) düz saniye. Çözülemezse undefined. */
function parseStrongDuration(raw: string, numericSeconds: boolean): number | undefined {
  const s = raw.trim().toLowerCase()
  if (s === '') return undefined
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    const n = parseFloat(s.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined
  }
  if (numericSeconds) return undefined
  const m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/.exec(s)
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return undefined
  return +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0)
}

/** Ondalık virgül/nokta; çözülemezse NaN. */
function toNumber(raw: string): number {
  const s = raw.trim().replace(',', '.')
  if (s === '') return NaN
  return Number(s)
}

/**
 * Satırın tekrar, set süresi ve mesafesinden set içeriği: tekrar varsa tekrarlı (mesafe de olsa, örn. kızak
 * itme); tekrar yok, mesafe varsa mesafe seti (reps = setin süresi, sn; mesafe dosya biriminde); tekrar ve
 * mesafe yok, set süresi varsa süreli (reps = saniye, 3600'e çekilir); aksi hâlde null (satır atlanır).
 */
function rowContent(
  repsRaw: string,
  secRaw: string,
  distanceRaw: string,
): { reps: number; timed?: true; distance?: number } | null {
  const reps = toNumber(repsRaw)
  if (Number.isFinite(reps) && reps > 0) return { reps }
  const sec = toNumber(secRaw)
  const distance = toNumber(distanceRaw)
  if (distance > 0 && Number.isFinite(distance)) return { reps: sec > 0 ? clampDistanceSec(sec) : 0, distance }
  if (!(sec > 0)) return null
  return { reps: Math.max(1, clampSec(sec)), timed: true }
}

/** Mesafe sütunu başlığındaki birim: "distance (meters)", "distance (km)", "distance_km", "distance_miles"… */
function distanceUnitOf(header: string): DistanceUnit | undefined {
  if (/\bkm\b|_km$|kilomet/.test(header)) return 'km'
  if (/\bmi\b|_mi$|mile/.test(header)) return 'mi'
  if (/\bm\b|_m$|meter|metre/.test(header)) return 'm'
  return undefined
}

/** Setin türü; bir egzersizin setleri aynı türden olmalıdır (tekrar, süre ya da mesafe). */
const setKind = (s: ImportedSet): string => (s.distance !== undefined ? 'distance' : s.timed ? 'timed' : 'reps')

function cleanWeight(raw: string): number {
  const n = toNumber(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Aynı egzersiz adını ilk görünüşte toplayan, sıralı çalışma kovası. */
class WorkoutBuilder {
  private readonly map = new Map<string, ImportedWorkout>()
  private readonly order: ImportedWorkout[] = []

  /** Seti ekler; egzersizin önceki setleriyle türü (tekrarlı/süreli/mesafe) çelişiyorsa eklemez ve false döner. */
  add(key: string, make: () => ImportedWorkout, exName: string, supersetId: string, set: ImportedSet): boolean {
    let w = this.map.get(key)
    if (!w) {
      w = make()
      this.map.set(key, w)
      this.order.push(w)
    }
    let entry = w.entries.find((e) => e.name === exName)
    if (!entry) {
      entry = { name: exName, sets: [] } as ImportedEntry
      w.entries.push(entry)
    }
    if (entry.sets.length > 0 && setKind(entry.sets[0]) !== setKind(set)) return false
    if (supersetId && entry.supersetId === undefined) entry.supersetId = supersetId
    entry.sets.push(set)
    return true
  }

  result(): ImportedWorkout[] {
    return this.order
      .map((w) => ({ ...w, entries: w.entries.filter((e) => e.sets.length > 0) }))
      .filter((w) => w.entries.length > 0)
      .map((w, i) => ({ w, i }))
      .sort((a, b) => a.w.start - b.w.start || a.i - b.i)
      .map(({ w }) => w)
  }
}

function colIndex(header: string[], pred: (h: string) => boolean): number {
  return header.findIndex(pred)
}

function finish(
  format: 'strong' | 'hevy',
  unit: Unit | null,
  distanceUnit: DistanceUnit | undefined,
  builder: WorkoutBuilder,
  skippedRows: number,
): ParsedImport {
  const warnings: string[] = []
  if (skippedRows > 0) warnings.push(t('importCsv.skippedRows', { n: skippedRows }))
  return { format, unit, ...(distanceUnit ? { distanceUnit } : {}), workouts: builder.result(), skippedRows, warnings }
}

function isBlankRow(r: string[]): boolean {
  return r.every((c) => c.trim() === '')
}

function parseStrong(header: string[], rows: string[][]): ParsedImport {
  const cDate = colIndex(header, (h) => h === 'date')
  const cName = colIndex(header, (h) => h === 'workout name')
  const cDur = colIndex(header, (h) => h.startsWith('duration'))
  const cEx = colIndex(header, (h) => h === 'exercise name')
  const cOrder = colIndex(header, (h) => h === 'set order')
  const cWeight = colIndex(header, (h) => h.startsWith('weight'))
  const cReps = colIndex(header, (h) => h === 'reps')
  const cSec = colIndex(header, (h) => h === 'seconds')
  const cDist = colIndex(header, (h) => h.startsWith('distance'))

  const wh = cWeight >= 0 ? header[cWeight] : ''
  const unit: Unit | null = /\(kg\)/.test(wh) ? 'kg' : /\(lbs?\)/.test(wh) ? 'lb' : null
  const durNumeric = cDur >= 0 && header[cDur].includes('sec')
  const get = (r: string[], c: number) => (c >= 0 ? (r[c] ?? '').trim() : '')

  const builder = new WorkoutBuilder()
  let skipped = 0
  for (const r of rows) {
    if (isBlankRow(r)) continue
    const order = get(r, cOrder)
    if (order.toLowerCase() === 'rest timer') continue
    const exName = get(r, cEx)
    const content = rowContent(get(r, cReps), get(r, cSec), get(r, cDist))
    const dateRaw = get(r, cDate)
    const when = parseIsoLocal(dateRaw)
    if (exName === '' || !content || !when) {
      skipped++
      continue
    }
    const o = order.toUpperCase()
    const type: ImportedSet['type'] = o === 'W' ? 'warmup' : o === 'D' ? 'drop' : 'normal'
    const wName = get(r, cName)
    const durRaw = get(r, cDur)
    const added = builder.add(
      `${dateRaw}\u0000${wName}`,
      () => ({
        name: wName,
        start: when.ms,
        date: when.date,
        durationSec: cDur >= 0 ? parseStrongDuration(durRaw, durNumeric) : undefined,
        entries: [],
      }),
      exName,
      '',
      { type, weight: cleanWeight(get(r, cWeight)), ...content },
    )
    if (!added) skipped++
  }
  return finish('strong', unit, cDist >= 0 ? distanceUnitOf(header[cDist]) : undefined, builder, skipped)
}

function parseHevy(header: string[], rows: string[][]): ParsedImport {
  const cTitle = colIndex(header, (h) => h === 'title')
  const cStart = colIndex(header, (h) => h === 'start_time')
  const cEnd = colIndex(header, (h) => h === 'end_time')
  const cEx = colIndex(header, (h) => h === 'exercise_title')
  const cSuper = colIndex(header, (h) => h === 'superset_id')
  const cType = colIndex(header, (h) => h === 'set_type')
  const cKg = colIndex(header, (h) => h === 'weight_kg')
  const cLb = colIndex(header, (h) => h === 'weight_lbs' || h === 'weight_lb')
  const cReps = colIndex(header, (h) => h === 'reps')
  const cSec = colIndex(header, (h) => h === 'duration_seconds')
  const cDist = colIndex(header, (h) => h.startsWith('distance'))
  const cWeight = cKg >= 0 ? cKg : cLb
  const unit: Unit | null = cKg >= 0 ? 'kg' : cLb >= 0 ? 'lb' : null
  const get = (r: string[], c: number) => (c >= 0 ? (r[c] ?? '').trim() : '')

  const builder = new WorkoutBuilder()
  let skipped = 0
  for (const r of rows) {
    if (isBlankRow(r)) continue
    const exName = get(r, cEx)
    const content = rowContent(get(r, cReps), get(r, cSec), get(r, cDist))
    const startRaw = get(r, cStart)
    const when = parseHevyDate(startRaw)
    if (exName === '' || !content || !when) {
      skipped++
      continue
    }
    const st = get(r, cType).toLowerCase()
    const type: ImportedSet['type'] = st === 'warmup' ? 'warmup' : st === 'dropset' ? 'drop' : 'normal'
    const title = get(r, cTitle)
    const end = cEnd >= 0 ? parseHevyDate(get(r, cEnd)) : null
    const durSec = end ? Math.round((end.ms - when.ms) / 1000) : 0
    const added = builder.add(
      `${title}\u0000${startRaw}`,
      () => ({
        name: title,
        start: when.ms,
        date: when.date,
        durationSec: durSec > 0 ? durSec : undefined,
        entries: [],
      }),
      exName,
      get(r, cSuper),
      { type, weight: cleanWeight(get(r, cWeight)), ...content },
    )
    if (!added) skipped++
  }
  return finish('hevy', unit, cDist >= 0 ? distanceUnitOf(header[cDist]) : undefined, builder, skipped)
}

/** Strong ya da Hevy CSV dışa aktarımını biçimini otomatik tanıyarak ayrıştırır. */
export function parseImport(text: string): ParsedImport {
  const all = parseCsv(text)
  if (all.length === 0 || all.every(isBlankRow)) {
    throw new Error(t('importCsv.empty'))
  }
  const header = all[0].map((h) => h.trim().toLowerCase())
  const rows = all.slice(1)
  if (header.includes('exercise_title') && header.includes('start_time')) return parseHevy(header, rows)
  if (header.includes('exercise name') && header.includes('set order')) return parseStrong(header, rows)
  throw new Error(
    t('importCsv.unknown'),
  )
}
