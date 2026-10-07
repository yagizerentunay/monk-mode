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

/** Gösterim için en fazla bir ondalık; tam sayılarda ondalık yok. */
export function formatWeight(kg: number, unit: Unit): string {
  const v = roundTo(kgToUnit(kg, unit), 0.1)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
