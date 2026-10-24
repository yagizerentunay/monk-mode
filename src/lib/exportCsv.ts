import type { MeasurementEntry, SetEntry, Workout } from '../store/schema.ts'
import { setMeters } from './distance.ts'
import { describeSets, type SetKind } from './intensity.ts'
import { effectiveLoad } from './load.ts'
import { MEASURE_KEYS, MEASURE_LABEL, MEASURE_UNIT } from './measurements.ts'
import { SIDES } from './sets.ts'
import { formatDecimal, formatWeight, type Unit } from './units.ts'

/** Türkçe Excel'in beklediği ayraç; ondalık ayracı da virgüldür, bu yüzden alanlar noktalı virgülle ayrılır. */
const SEP = ';'
const EOL = '\r\n'
/** Excel'in dosyayı UTF-8 (ve Türkçe karakterleri doğru) okuması için. */
const BOM = '﻿'

export const CSV_HEADERS = [
  'Tarih',
  'Antrenman',
  'Egzersiz',
  'Set türü',
  'Set no',
  'Taraf',
  'Ağırlık',
  'Vücut ağırlığı',
  'Toplam yük',
  'Tekrar',
  'RIR',
  'Egzersiz notu',
  'Antrenman notu',
  // Sona eklendi: önceki sütun konumları (Excel formülleri) değişmesin. Süreli sette tekrar boş, süre dolu.
  'Süre (sn)',
  // Sona eklendi (aynı nedenle). Mesafe setinde (koşu, kürek…) metre; ağırlık ve tekrar boş, süre "Süre (sn)"de.
  'Mesafe (m)',
] as const

export interface CsvOptions {
  /** Ağırlıkların yazılacağı birim (veride her zaman kg tutulur). */
  unit: Unit
  /** Egzersiz kimliğinden görünen ad; bilinmiyorsa kimliği döndürmelidir. */
  names: (exId: string) => string
}

const KIND_LABEL: Record<SetKind, string> = { warmup: 'Isınma', work: 'Çalışma', drop: 'Drop' }
const SIDE_LABEL = { L: 'Sol', R: 'Sağ' } as const

/** RFC 4180: ayraç, tırnak ya da satır sonu içeren alan tırnaklanır, içindeki tırnaklar ikilenir. */
function quote(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

/**
 * Serbest metin alanı. Excel `=`, `+`, `-`, `@` ile başlayan hücreyi formül sayar (içe aktarılan bir not
 * bile formül çalıştırabilir); başa kesme işareti konur, böylece metin olarak görünür.
 */
function text(value: string | undefined): string {
  if (!value) return ''
  return quote(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)
}

/** Ondalık virgül, binlik ayracı yok; birimde en fazla bir ondalık (bkz. formatWeight). */
function num(kg: number, unit: Unit): string {
  return formatWeight(kg, unit).replace('.', ',')
}

/**
 * Tamamlanan setleri Excel için CSV'ye çevirir: tamamlanan her set bir satır, tek taraflıda taraf başına
 * bir satır (süreli egzersizde "Tekrar" boş, "Süre (sn)" tutulan saniyedir; mesafe egzersizinde ağırlık ve
 * "Tekrar" boş, "Süre (sn)" setin süresi, "Mesafe (m)" mesafedir). Tamamlanmamış set atlanır; yalnız bir tarafı yapılmış yarım sette yapılan taraf yazılır.
 * Sıra: tarih / başlangıç, egzersiz sırası, set sırası.
 */
export function workoutsToCsv(workouts: readonly Workout[], opts: CsvOptions): string {
  const { unit, names } = opts
  const rows: string[][] = []
  const ordered = [...workouts].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.start - b.start))

  for (const w of ordered) {
    for (const entry of w.entries) {
      const metas = describeSets(entry.sets)
      const seconds = entry.timed || entry.distance
      entry.sets.forEach((set: SetEntry, i) => {
        const meta = metas[i]
        const base = (side: string, reps: number): string[] => [
          w.d,
          text(w.name),
          text(names(entry.exId)),
          KIND_LABEL[meta.kind],
          meta.name.replace(/^\D+/, ''),
          side,
          entry.distance ? '' : num(set.w, unit),
          entry.bw && entry.bwKg !== undefined && !entry.distance ? num(entry.bwKg, unit) : '',
          entry.distance ? '' : num(effectiveLoad(entry, set.w), unit),
          seconds ? '' : String(reps),
          set.rir === undefined ? '' : String(set.rir),
          text(entry.note),
          text(w.note),
          seconds ? String(reps) : '',
          entry.distance ? String(setMeters(set)) : '',
        ]
        if (set.sides) {
          for (const s of SIDES) if (set.sides[s].done) rows.push(base(SIDE_LABEL[s], set.sides[s].r))
        } else if (set.done) {
          rows.push(base('', set.r))
        }
      })
    }
  }

  return BOM + [CSV_HEADERS.map(quote), ...rows].map((r) => r.join(SEP)).join(EOL) + EOL
}

export const MEASUREMENT_CSV_HEADERS = [
  'Tarih',
  ...MEASURE_KEYS.map((k) => `${MEASURE_LABEL[k]} (${MEASURE_UNIT[k]})`),
] as const

/**
 * Vücut ölçülerini antrenmanlardan ayrı bir CSV'ye çevirir (sütunları farklı olduğundan aynı dosyaya
 * girmez): her gün bir satır, ölçülmeyen alan boş, ondalık virgül. Sıra: tarih.
 */
export function measurementsToCsv(entries: readonly MeasurementEntry[]): string {
  const rows = [...entries]
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
    .map((e) => [e.d, ...MEASURE_KEYS.map((k) => (e[k] === undefined ? '' : formatDecimal(e[k])))])
  return BOM + [MEASUREMENT_CSV_HEADERS.map(quote), ...rows].map((r) => r.join(SEP)).join(EOL) + EOL
}
