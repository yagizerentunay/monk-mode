import { describe, expect, it } from 'vitest'
import { DEFAULT_KITS, formatPlates, plateTargets, platesFor } from './plates.ts'

const kg = DEFAULT_KITS.kg

describe('plaka hesabı', () => {
  it('taraf başına plakaları ağırdan hafife verir', () => {
    expect(platesFor(60, kg)).toMatchObject({ perSide: [{ plate: 20, count: 1 }], loaded: 60, short: 0 })
    expect(platesFor(62.5, kg).perSide).toEqual([
      { plate: 20, count: 1 },
      { plate: 1.25, count: 1 },
    ])
  })

  it('aynı plakadan birden çoğunu gruplar', () => {
    expect(platesFor(140, kg).perSide).toEqual([{ plate: 25, count: 2 }, { plate: 10, count: 1 }])
    expect(platesFor(140, kg).loaded).toBe(140)
  })

  it('eşit plaka sayısında ağır plakayı önce seçer', () => {
    expect(platesFor(100, kg).perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 15, count: 1 },
    ])
  })

  it('açgözlünün kaçırdığı kombinasyonu bulur', () => {
    const kit = { bar: 20, plates: [25, 20] }
    expect(platesFor(100, kit)).toMatchObject({ perSide: [{ plate: 20, count: 2 }], loaded: 100, short: 0 })
  })

  it('tutturulamayan yükte hedefi aşmayan en yakın yükü seçer ve farkı bildirir', () => {
    const r = platesFor(61, kg)
    expect(r.loaded).toBe(60)
    expect(r.short).toBe(1)
  })

  it('yalnız bar hedefinde plaka yok, bardan hafifte uyarı var', () => {
    expect(platesFor(20, kg)).toMatchObject({ perSide: [], loaded: 20, short: 0, belowBar: false })
    expect(platesFor(15, kg)).toMatchObject({ perSide: [], loaded: 20, belowBar: true })
    expect(platesFor(0, kg).belowBar).toBe(true)
  })

  it('plakası olmayan kitte tüm farkı eksik sayar', () => {
    expect(platesFor(50, { bar: 20, plates: [] })).toMatchObject({ perSide: [], loaded: 20, short: 30 })
  })

  it('geçersiz plaka değerlerini yok sayar', () => {
    expect(platesFor(60, { bar: 20, plates: [20, 0, -5, NaN] }).perSide).toEqual([{ plate: 20, count: 1 }])
  })

  it('lb kitinde çalışır', () => {
    const lb = DEFAULT_KITS.lb
    expect(platesFor(225, lb).perSide).toEqual([{ plate: 45, count: 2 }])
    expect(platesFor(135, lb).perSide).toEqual([{ plate: 45, count: 1 }])
  })

  it('küsuratlı plakalarda kayan nokta hatası üretmez', () => {
    const r = platesFor(24.5, { bar: 20, plates: [1.25, 0.5] })
    expect(r.perSide).toEqual([{ plate: 1.25, count: 1 }, { plate: 0.5, count: 2 }])
    expect(r.loaded).toBe(24.5)
    expect(r.short).toBe(0)
    // 23,75 taraf başına 1,875 ister; {1,25; 0,5} ile en yakın alt yük 23,5
    expect(platesFor(23.75, { bar: 20, plates: [1.25, 0.5] })).toMatchObject({ loaded: 23.5, short: 0.25 })
  })

  it('aşırı büyük hedefte takılmaz', () => {
    const r = platesFor(1e9, kg)
    expect(r.loaded).toBeLessThanOrEqual(1500)
    expect(r.short).toBeGreaterThan(0)
  })
})

describe('hesaplayıcı hedefleri', () => {
  const set = (w: number, done: boolean) => ({ w, done })

  it('ağırlıkları tekilleştirip artan sıralar, sıfırı atar', () => {
    expect(plateTargets([set(60, false), set(0, false), set(40, true), set(60, true)]).weights).toEqual([40, 60])
  })

  it('açılışta sıradaki yapılmamış seti seçer', () => {
    expect(plateTargets([set(40, true), set(60, false), set(80, false)]).initial).toBe(60)
  })

  it('hepsi bittiyse en ağır seti, set yoksa sıfırı seçer', () => {
    expect(plateTargets([set(40, true), set(80, true)]).initial).toBe(80)
    expect(plateTargets([])).toEqual({ weights: [], initial: 0 })
  })
})

describe('plaka metni', () => {
  it('sayıları ve çarpımı biçimler', () => {
    expect(formatPlates([{ plate: 20, count: 2 }, { plate: 1.25, count: 1 }])).toBe('2 × 20 + 1.25')
    expect(formatPlates([])).toBeNull()
  })
})
