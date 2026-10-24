import type { MeasurementEntry } from '../store/schema.ts'

/** Ölçü alanları; kayıt, grafik çipleri ve CSV sütunları bu sırayı izler. */
export const MEASURE_KEYS = ['waist', 'chest', 'arm', 'hip', 'fat'] as const
export type MeasureKey = (typeof MEASURE_KEYS)[number]

export const MEASURE_LABEL: Record<MeasureKey, string> = {
  waist: 'Bel',
  chest: 'Göğüs',
  arm: 'Kol',
  hip: 'Kalça',
  fat: 'Yağ',
}

/** Çevreler cm, yağ oranı yüzde; kg/lb ayarı ölçülere uygulanmaz. */
export const MEASURE_UNIT: Record<MeasureKey, string> = { waist: 'cm', chest: 'cm', arm: 'cm', hip: 'cm', fat: '%' }

/** Makul üst sınırlar: çevre en çok 300 cm, yağ oranı en çok %99,9 (üstü yazım hatası ya da bozuk yedek). */
const MAX: Record<MeasureKey, number> = { waist: 300, chest: 300, arm: 300, hip: 300, fat: 99.9 }

/** Ölçü değeri geçerliyse bir ondalığa yuvarlanmış hâli, değilse undefined. Sıfır "ölçülmedi" demektir, geçersizdir. */
export function cleanMeasure(key: MeasureKey, v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  const r = Math.round(v * 10) / 10
  return r > 0 && r <= MAX[key] ? r : undefined
}

/** Kayıtta en az bir ölçü var mı. */
export function hasMeasure(e: Partial<MeasurementEntry>): boolean {
  return MEASURE_KEYS.some((k) => e[k] !== undefined)
}

/** Geçerli ölçüleri `MEASURE_KEYS` sırasıyla tutan yeni kayıt; hiç geçerli ölçü yoksa null. */
export function cleanMeasurement(e: MeasurementEntry): MeasurementEntry | null {
  const out: MeasurementEntry = { d: e.d }
  for (const k of MEASURE_KEYS) {
    const v = cleanMeasure(k, e[k])
    if (v !== undefined) out[k] = v
  }
  return hasMeasure(out) ? out : null
}

/**
 * Formdaki metni sayıya çevirir: virgül ya da nokta ondalık ayracı olabilir. Boş metin "ölçülmedi"
 * (undefined); sayı olmayan ya da sınır dışı metin null.
 */
export function parseMeasure(key: MeasureKey, text: string): number | undefined | null {
  const t = text.trim()
  if (t === '') return undefined
  const n = Number(t.replace(',', '.'))
  return cleanMeasure(key, n) ?? null
}

export interface MeasurePoint {
  d: string
  value: number
}

/** Bir ölçünün seyri: o ölçüsü olan kayıtlar, tarih sırasında. */
export function measureSeries(entries: readonly MeasurementEntry[], key: MeasureKey): MeasurePoint[] {
  return entries.flatMap((e) => (e[key] === undefined ? [] : [{ d: e.d, value: e[key] }]))
}

/** Son iki ölçüm arasındaki fark (bir ondalık); ikinci ölçüm yoksa null. */
export function lastChange(points: readonly MeasurePoint[]): number | null {
  if (points.length < 2) return null
  return Math.round((points[points.length - 1].value - points[points.length - 2].value) * 10) / 10
}
