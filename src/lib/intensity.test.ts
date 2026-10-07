import { describe, expect, it } from 'vitest'
import type { SetEntry } from '../store/schema.ts'
import { dropChain, dropSet, roundLoad, warmupSet, warmupSets } from './intensity.ts'

describe('yük yuvarlama', () => {
  it('ağır yüklerde 2,5 kg adıma yuvarlar', () => {
    expect(roundLoad(48)).toBe(47.5)
    expect(roundLoad(80)).toBe(80)
  })

  it('hafif yüklerde 1 kg adıma yuvarlar', () => {
    expect(roundLoad(8)).toBe(8)
    expect(roundLoad(7.4)).toBe(7)
  })

  it('pozitif yükü sıfıra yuvarlamaz, sıfırı sıfır bırakır', () => {
    expect(roundLoad(0.3)).toBe(1)
    expect(roundLoad(0)).toBe(0)
    expect(roundLoad(-5)).toBe(0)
  })
})

describe('ısınma rampası', () => {
  it('çalışma ağırlığının %40, %60, %80 yüzdesini ve 8-5-3 tekrarı verir', () => {
    expect(warmupSets(100, 3)).toEqual([
      { w: 40, r: 8, done: false, warmup: true },
      { w: 60, r: 5, done: false, warmup: true },
      { w: 80, r: 3, done: false, warmup: true },
    ])
  })

  it('sayı sınırını uygular ve negatifi sıfır sayar', () => {
    expect(warmupSets(100, 9)).toHaveLength(4)
    expect(warmupSets(100, -1)).toEqual([])
  })

  it('beşinci ve sonrası son basamağı tekrarlar', () => {
    expect(warmupSet(100, 7).w).toBe(85)
  })

  it('ağırlık 0 ise ısınma ağırlığı da 0', () => {
    expect(warmupSet(0, 0).w).toBe(0)
  })
})

describe('dropset', () => {
  const main: SetEntry = { w: 60, r: 8, done: true }

  it('önceki setin %80 ağırlığı ve aynı tekrar hedefiyle başlar', () => {
    expect(dropSet(main)).toEqual({ w: 47.5, r: 8, done: false, drop: true })
  })

  it('zincirde her drop bir öncekinden hesaplanır', () => {
    expect(dropChain(main, 3).map((s) => s.w)).toEqual([47.5, 37.5, 30])
  })

  it('zincir uzunluğunu sınırlar', () => {
    expect(dropChain(main, 10)).toHaveLength(3)
    expect(dropChain(main, 0)).toEqual([])
  })

  it('tek taraflı sette sol/sağ hedeflerini taşır ve tamamlanmamış başlar', () => {
    const uni: SetEntry = { w: 20, r: 8, done: true, sides: { L: { r: 10, done: true }, R: { r: 8, done: true } } }
    const d = dropSet(uni)
    expect(d.sides).toEqual({ L: { r: 10, done: false }, R: { r: 8, done: false } })
    expect(d).toMatchObject({ w: 16, r: 8, done: false, drop: true })
  })

  it('tek taraflı olmayanı tek taraflı yapmaz', () => {
    expect(dropSet(main).sides).toBeUndefined()
  })
})
