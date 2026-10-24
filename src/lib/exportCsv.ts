import { getLang, t, type Lang, type MessageKey } from '../i18n/index.ts'
import type { MeasurementEntry, SetEntry, Workout } from '../store/schema.ts'
import { setMeters } from './distance.ts'
import { describeSets, type SetKind } from './intensity.ts'
import { effectiveLoad } from './load.ts'
import { MEASURE_KEYS, MEASURE_UNIT } from './measurements.ts'
import { SIDES } from './sets.ts'
import { formatWeight, type Unit } from './units.ts'

/**
 * Dosya biçimi arayüz diline göre: Türkçe Excel noktalı virgül ayraç ve virgül ondalık bekler; İngilizce
 * (ve Numbers, Google Sheets) virgül ayraç ve nokta ondalık. Başlıklar ve set türü/taraf adları da o dilde.
 */
const SEP: Record<Lang, string> = { tr: ';', en: ',' }
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

/** İngilizce dosyanın başlıkları; sıra ve anlam `CSV_HEADERS` ile birebir aynı. */
export const CSV_HEADERS_EN = [
  'Date',
  'Workout',
  'Exercise',
  'Set type',
  'Set no',
  'Side',
  'Weight',
  'Bodyweight',
  'Total load',
  'Reps',
  'RIR',
  'Exercise note',
  'Workout note',
  'Time (s)',
  'Distance (m)',
] as const

export interface CsvOptions {
  /** Ağırlıkların yazılacağı birim (veride her zaman kg tutulur). */
  unit: Unit
  /** Egzersiz kimliğinden görünen ad; bilinmiyorsa kimliği döndürmelidir. */
  names: (exId: string) => string
  /** Dosya dili ve biçimi; verilmezse geçerli arayüz dili. */
  lang?: Lang
}

const KIND_LABEL: Record<SetKind, MessageKey> = { warmup: 'csvRow.warmup', work: 'csvRow.work', drop: 'csvRow.drop' }
const SIDE_LABEL = { L: 'side.L', R: 'side.R' } as const satisfies Record<string, MessageKey>

/** RFC 4180: ayraç, tırnak ya da satır sonu içeren alan tırnaklanır, içindeki tırnaklar ikilenir. */
function quote(field: string, lang: Lang): string {
  const special = lang === 'tr' ? /[;"\r\n]/ : /[,"\r\n]/
  return special.test(field) ? `"${field.replace(/"/g, '""')}"` : field
}

/** Noktalı ondalık metni dosya dilinin ondalık ayracına çevirir (Türkçede virgül). */
function decimal(text: string, lang: Lang): string {
  const dot = text.replace(',', '.')
  return lang === 'tr' ? dot.replace('.', ',') : dot
}

/**
 * Serbest metin alanı. Excel `=`, `+`, `-`, `@` ile başlayan hücreyi formül sayar (içe aktarılan bir not
 * bile formül çalıştırabilir); başa kesme işareti konur, böylece metin olarak görünür.
 */
function text(value: string | undefined, lang: Lang): string {
  if (!value) return ''
  return quote(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value, lang)
}

/** Ondalık virgül (İngilizcede nokta), binlik ayracı yok; birimde en fazla bir ondalık (bkz. formatWeight). */
function num(kg: number, unit: Unit, lang: Lang): string {
  return decimal(formatWeight(kg, unit), lang)
}

/**
 * Tamamlanan setleri Excel için CSV'ye çevirir: tamamlanan her set bir satır, tek taraflıda taraf başına
 * bir satır (süreli egzersizde "Tekrar" boş, "Süre (sn)" tutulan saniyedir; mesafe egzersizinde ağırlık ve
 * "Tekrar" boş, "Süre (sn)" setin süresi, "Mesafe (m)" mesafedir). Tamamlanmamış set atlanır; yalnız bir tarafı yapılmış yarım sette yapılan taraf yazılır.
 * Sıra: tarih / başlangıç, egzersiz sırası, set sırası.
 */
export function workoutsToCsv(workouts: readonly Workout[], opts: CsvOptions): string {
  const { unit, names, lang = getLang() } = opts
  const headers = lang === 'tr' ? CSV_HEADERS : CSV_HEADERS_EN
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
          text(w.name, lang),
          text(names(entry.exId), lang),
          t(KIND_LABEL[meta.kind], undefined, lang),
          meta.name.replace(/^\D+/, ''),
          side,
          entry.distance ? '' : num(set.w, unit, lang),
          entry.bw && entry.bwKg !== undefined && !entry.distance ? num(entry.bwKg, unit, lang) : '',
          entry.distance ? '' : num(effectiveLoad(entry, set.w), unit, lang),
          seconds ? '' : String(reps),
          set.rir === undefined ? '' : String(set.rir),
          text(entry.note, lang),
          text(w.note, lang),
          seconds ? String(reps) : '',
          entry.distance ? String(setMeters(set)) : '',
        ]
        if (set.sides) {
          for (const s of SIDES) if (set.sides[s].done) rows.push(base(t(SIDE_LABEL[s], undefined, lang), set.sides[s].r))
        } else if (set.done) {
          rows.push(base('', set.r))
        }
      })
    }
  }

  return BOM + [headers.map((h) => quote(h, lang)), ...rows].map((r) => r.join(SEP[lang])).join(EOL) + EOL
}

const MEASURE_KEY: Record<(typeof MEASURE_KEYS)[number], MessageKey> = {
  waist: 'measure.waist',
  chest: 'measure.chest',
  arm: 'measure.arm',
  hip: 'measure.hip',
  fat: 'measure.fat',
}

/** Ölçü dosyasının başlıkları, verilen dilde. */
export function measurementCsvHeaders(lang: Lang): string[] {
  return [t('csvRow.date', undefined, lang), ...MEASURE_KEYS.map((k) => `${t(MEASURE_KEY[k], undefined, lang)} (${MEASURE_UNIT[k]})`)]
}

/** Türkçe ölçü dosyasının başlıkları (eski sabit; bkz. measurementCsvHeaders). */
export const MEASUREMENT_CSV_HEADERS = measurementCsvHeaders('tr')

/**
 * Vücut ölçülerini antrenmanlardan ayrı bir CSV'ye çevirir (sütunları farklı olduğundan aynı dosyaya
 * girmez): her gün bir satır, ölçülmeyen alan boş, ondalık virgül. Sıra: tarih.
 */
export function measurementsToCsv(entries: readonly MeasurementEntry[], lang: Lang = getLang()): string {
  const rows = [...entries]
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
    .map((e) => [e.d, ...MEASURE_KEYS.map((k) => (e[k] === undefined ? '' : decimal(String(e[k]), lang)))])
  return BOM + [measurementCsvHeaders(lang).map((h) => quote(h, lang)), ...rows].map((r) => r.join(SEP[lang])).join(EOL) + EOL
}
