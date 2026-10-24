import { getLang } from '../i18n/index.ts'

export type Unit = 'kg' | 'lb'

const LB_PER_KG = 2.20462

/** Verilerde ağırlık her zaman kg tutulur; birim yalnız gösterimde uygulanır. */
export function kgToUnit(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg
}

export function unitToKg(value: number, unit: Unit): number {
  return unit === 'lb' ? value / LB_PER_KG : value
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Sayıyı arayüz dilinin ondalık ayracıyla yazar: Türkçede virgül (62.5 → "62,5"), İngilizcede nokta
 * ("62.5"). Arayüzdeki tüm ağırlık ve ondalık gösterimleri bunu kullanır.
 */
export function formatDecimal(n: number): string {
  return localizeDecimal(String(n))
}

/** Noktalı ondalık metni ("5.0") arayüz dilinin ayracına çevirir: Türkçede "5,0". */
export function localizeDecimal(text: string): string {
  return getLang() === 'tr' ? text.replace('.', ',') : text
}

/** Gösterim için en fazla bir ondalık (virgülle); tam sayılarda ondalık yok. */
export function formatWeight(kg: number, unit: Unit): string {
  const v = roundTo(kgToUnit(kg, unit), 0.1)
  return formatDecimal(Number.isInteger(v) ? v : Number(v.toFixed(1)))
}
