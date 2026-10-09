import { describe, expect, it } from 'vitest'
import type { SetEntry, WorkoutEntry } from '../store/schema.ts'
import { makeSides } from './sets.ts'
import { isZeroWeightSet, needsExternalLoad, zeroWeightFlags } from './zeroWeight.ts'

const set = (patch: Partial<SetEntry> = {}): SetEntry => ({ w: 0, r: 8, done: true, ...patch })
const entry = (sets: SetEntry[], bw?: boolean): WorkoutEntry => ({ exId: 'x', sets, ...(bw ? { bw } : {}) })

describe('needsExternalLoad', () => {
  it.each(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'e-z curl bar'])('%s dış yük gerektirir', (eq) => {
    expect(needsExternalLoad(eq)).toBe(true)
  })

  it.each(['body only', 'bands', 'other', 'foam roll', 'medicine ball', 'exercise ball'])('%s muaf', (eq) => {
    expect(needsExternalLoad(eq)).toBe(false)
  })

  it('boş, null, undefined ve tanınmayan değer muaf', () => {
    expect(needsExternalLoad(null)).toBe(false)
    expect(needsExternalLoad(undefined)).toBe(false)
    expect(needsExternalLoad('')).toBe(false)
    expect(needsExternalLoad('   ')).toBe(false)
    expect(needsExternalLoad('sandbag')).toBe(false)
  })

  it('özel egzersizin serbest metninde büyük/küçük harf ve boşluk fark etmez', () => {
    expect(needsExternalLoad(' Barbell ')).toBe(true)
    expect(needsExternalLoad('DUMBBELL')).toBe(true)
  })
})

describe('isZeroWeightSet', () => {
  it('tamamlanmış çalışma setinde w=0 ve dış yüklü ekipman uyarır', () => {
    expect(isZeroWeightSet(entry([]), set(), 'barbell')).toBe(true)
  })

  it('tamamlanmamış set uyarmaz', () => {
    expect(isZeroWeightSet(entry([]), set({ done: false }), 'barbell')).toBe(false)
  })

  it('ısınma seti uyarmaz', () => {
    expect(isZeroWeightSet(entry([]), set({ warmup: true }), 'barbell')).toBe(false)
  })

  it('pozitif ağırlık uyarmaz, negatif uyarır', () => {
    expect(isZeroWeightSet(entry([]), set({ w: 0.5 }), 'barbell')).toBe(false)
    expect(isZeroWeightSet(entry([]), set({ w: 45 }), 'barbell')).toBe(false)
    expect(isZeroWeightSet(entry([]), set({ w: -5 }), 'barbell')).toBe(true)
  })

  it('bw girdisi muaf: ek yük 0 normal (asist dahil)', () => {
    expect(isZeroWeightSet(entry([], true), set(), 'machine')).toBe(false)
    expect(isZeroWeightSet(entry([], true), set({ w: -20 }), 'machine')).toBe(false)
  })

  it('body only, bilinmeyen ve boş ekipman muaf', () => {
    expect(isZeroWeightSet(entry([]), set(), 'body only')).toBe(false)
    expect(isZeroWeightSet(entry([]), set(), 'sandbag')).toBe(false)
    expect(isZeroWeightSet(entry([]), set(), null)).toBe(false)
    expect(isZeroWeightSet(entry([]), set(), undefined)).toBe(false)
  })

  it('dropset çalışma seti sayılır', () => {
    expect(isZeroWeightSet(entry([]), set({ drop: true }), 'cable')).toBe(true)
  })

  it('tek taraflı sette taraf başı ağırlık aynı kuralla değerlendirilir', () => {
    const sided = set({ sides: makeSides(10, true) })
    expect(isZeroWeightSet(entry([]), sided, 'dumbbell')).toBe(true)
    expect(isZeroWeightSet(entry([]), { ...sided, w: 12 }, 'dumbbell')).toBe(false)
    // Bir taraf bitmediyse set `done` değildir: uyarı yok.
    expect(isZeroWeightSet(entry([]), set({ done: false, sides: makeSides(10, false) }), 'dumbbell')).toBe(false)
  })
})

describe('zeroWeightFlags', () => {
  it('45×8, 45×8, 0×8 örneğinde yalnız son seti işaretler', () => {
    const e = entry([set({ w: 45 }), set({ w: 45 }), set({ w: 0 })])
    expect(zeroWeightFlags(e, 'barbell')).toEqual([false, false, true])
  })

  it('ısınma ve yapılmamış setleri atlar, sıra korunur', () => {
    const e = entry([set({ warmup: true }), set({ w: 40 }), set({ done: false }), set()])
    expect(zeroWeightFlags(e, 'machine')).toEqual([false, false, false, true])
  })

  it('bw girdisinde ya da muaf ekipmanda hepsi false', () => {
    const sets = [set(), set()]
    expect(zeroWeightFlags(entry(sets, true), 'cable')).toEqual([false, false])
    expect(zeroWeightFlags(entry(sets), 'body only')).toEqual([false, false])
  })
})
