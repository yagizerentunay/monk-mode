import { describe, expect, it } from 'vitest'
import { cleanMeasure, cleanMeasurement, lastChange, measureSeries, parseMeasure } from './measurements.ts'

describe('cleanMeasure', () => {
  it('pozitif sonlu değeri bir ondalığa yuvarlar', () => {
    expect(cleanMeasure('waist', 82.04)).toBe(82)
    expect(cleanMeasure('waist', 82.06)).toBe(82.1)
    expect(cleanMeasure('fat', 14.5)).toBe(14.5)
  })

  it('sıfır, negatif, sonsuz, sayı olmayan ve sınır dışı değeri reddeder', () => {
    for (const v of [0, -1, 0.04, NaN, Infinity, '80', null, undefined]) expect(cleanMeasure('arm', v)).toBeUndefined()
    expect(cleanMeasure('hip', 300)).toBe(300)
    expect(cleanMeasure('hip', 300.1)).toBeUndefined()
    expect(cleanMeasure('fat', 99.9)).toBe(99.9)
    expect(cleanMeasure('fat', 100)).toBeUndefined()
    expect(cleanMeasure('fat', 99.96)).toBeUndefined()
  })
})

describe('cleanMeasurement', () => {
  it('geçerli ölçüleri sabit sırayla tutar, geçersizleri atar', () => {
    const raw = { fat: 15, d: '2026-10-01', waist: 0, arm: 35.55 } as never
    const out = cleanMeasurement(raw)
    expect(out).toEqual({ d: '2026-10-01', arm: 35.6, fat: 15 })
    expect(Object.keys(out!)).toEqual(['d', 'arm', 'fat'])
  })

  it('hiç geçerli ölçü yoksa null', () => {
    expect(cleanMeasurement({ d: '2026-10-01' })).toBeNull()
    expect(cleanMeasurement({ d: '2026-10-01', waist: -3 })).toBeNull()
  })
})

describe('parseMeasure', () => {
  it('virgül ya da nokta ondalık kabul eder', () => {
    expect(parseMeasure('waist', '82,5')).toBe(82.5)
    expect(parseMeasure('waist', ' 82.5 ')).toBe(82.5)
  })

  it('boş metin ölçülmedi, bozuk metin null', () => {
    expect(parseMeasure('chest', '')).toBeUndefined()
    expect(parseMeasure('chest', '  ')).toBeUndefined()
    expect(parseMeasure('chest', 'abc')).toBeNull()
    expect(parseMeasure('chest', '0')).toBeNull()
    expect(parseMeasure('fat', '120')).toBeNull()
  })
})

describe('measureSeries ve lastChange', () => {
  const entries = [
    { d: '2026-09-01', waist: 85, fat: 18 },
    { d: '2026-09-08', fat: 17.5 },
    { d: '2026-09-15', waist: 83.5 },
  ]

  it('yalnız o ölçüsü olan günleri sırayla verir', () => {
    expect(measureSeries(entries, 'waist')).toEqual([
      { d: '2026-09-01', value: 85 },
      { d: '2026-09-15', value: 83.5 },
    ])
    expect(measureSeries(entries, 'arm')).toEqual([])
  })

  it('son iki ölçüm arasındaki farkı verir; tek ölçümde null', () => {
    expect(lastChange(measureSeries(entries, 'waist'))).toBe(-1.5)
    expect(lastChange(measureSeries(entries, 'fat'))).toBe(-0.5)
    expect(lastChange([{ d: '2026-09-01', value: 1 }])).toBeNull()
    expect(lastChange([])).toBeNull()
  })
})
