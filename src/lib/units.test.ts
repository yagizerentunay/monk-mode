import { describe, expect, it } from 'vitest'
import { formatWeight, kgToUnit, roundTo, unitToKg } from './units.ts'

describe('units', () => {
  it('kg biriminde değeri değiştirmez', () => {
    expect(kgToUnit(100, 'kg')).toBe(100)
    expect(unitToKg(100, 'kg')).toBe(100)
  })

  it('kg ile lb arasında gidip gelir', () => {
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462, 3)
    expect(unitToKg(kgToUnit(82.5, 'lb'), 'lb')).toBeCloseTo(82.5, 6)
  })

  it('verilen adıma yuvarlar', () => {
    expect(roundTo(81.3, 2.5)).toBe(82.5)
    expect(roundTo(80.9, 0.5)).toBe(81)
  })

  it('ağırlığı kısa biçimde gösterir', () => {
    expect(formatWeight(80, 'kg')).toBe('80')
    expect(formatWeight(82.5, 'kg')).toBe('82.5')
    expect(formatWeight(100, 'lb')).toBe('220.5')
  })
})
