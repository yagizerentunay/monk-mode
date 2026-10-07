import { describe, expect, it } from 'vitest'
import type { SetEntry } from '../store/schema.ts'
import { describeSets, dropChain, dropSet, restAfterSec, roundLoad, warmupSet, warmupSets } from './intensity.ts'

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

describe('set numaralandırma', () => {
  const w = (): SetEntry => ({ w: 8, r: 8, done: false, warmup: true })
  const s = (): SetEntry => ({ w: 100, r: 5, done: false })
  const d = (): SetEntry => ({ w: 80, r: 5, done: false, drop: true })

  it('çalışma, ısınma ve drop setlerini ayrı sayar', () => {
    const meta = describeSets([w(), w(), s(), s(), d(), d()])
    expect(meta.map((m) => m.name)).toEqual(['Isınma 1', 'Isınma 2', 'Set 1', 'Set 2', 'Drop 1', 'Drop 2'])
    expect(meta.map((m) => m.badge)).toEqual(['Is', 'Is', '1', '2', '↓', '↓'])
  })

  it('drop yalnız zincirin son halkasında ve ısınmada değil eklenebilir', () => {
    const meta = describeSets([w(), s(), d(), s()])
    expect(meta.map((m) => m.canDrop)).toEqual([false, false, true, true])
  })

  it('zincir sınırına ulaşınca drop eklenemez', () => {
    const meta = describeSets([s(), d(), d(), d()])
    expect(meta[3].canDrop).toBe(false)
    expect(meta[0].canDrop).toBe(false) // zincirin ortasında değil: ardında drop var
  })
})

describe('dinlenme süresi', () => {
  const s = (): SetEntry => ({ w: 100, r: 5, done: true })
  const w = (): SetEntry => ({ w: 40, r: 8, done: true, warmup: true })
  const d = (): SetEntry => ({ w: 80, r: 5, done: true, drop: true })

  it('normal sette ayarlı süre kadar dinlenir', () => {
    expect(restAfterSec([s(), s()], 0, 120)).toBe(120)
  })

  it('ardından drop geliyorsa sayaç başlamaz', () => {
    expect(restAfterSec([s(), d()], 0, 120)).toBeNull()
  })

  it('son dropdan sonra normal dinlenir', () => {
    expect(restAfterSec([s(), d()], 1, 120)).toBe(120)
  })

  it('ısınmadan sonra kısa dinlenir ama ayardan uzun olmaz', () => {
    expect(restAfterSec([w(), s()], 0, 120)).toBe(45)
    expect(restAfterSec([w(), s()], 0, 30)).toBe(30)
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
