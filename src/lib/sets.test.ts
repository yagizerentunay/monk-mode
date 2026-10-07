import { describe, expect, it } from 'vitest'
import type { SetEntry } from '../store/schema.ts'
import { deriveSet, formatSet, makeSides, setReps, toBilateral, toUnilateral } from './sets.ts'

const uni = (l: number, r: number, ld = true, rd = true): SetEntry => ({
  w: 20,
  r: 0,
  done: false,
  sides: { L: { r: l, done: ld }, R: { r, done: rd } },
})

describe('tek taraflı set türetme', () => {
  it('zayıf tarafın tekrarını r olarak alır', () => {
    expect(deriveSet(uni(10, 8)).r).toBe(8)
    expect(deriveSet(uni(7, 9)).r).toBe(7)
  })

  it('yalnız iki taraf da tamamsa done olur', () => {
    expect(deriveSet(uni(10, 10, true, true)).done).toBe(true)
    expect(deriveSet(uni(10, 10, true, false)).done).toBe(false)
    expect(deriveSet(uni(10, 10, false, false)).done).toBe(false)
  })

  it('tek taraflı olmayan seti değiştirmez', () => {
    const s: SetEntry = { w: 60, r: 5, done: true }
    expect(deriveSet(s)).toBe(s)
  })
})

describe('toplam tekrar ve dönüşümler', () => {
  it('hacim için sol + sağ toplar', () => {
    expect(setReps(uni(10, 8))).toBe(18)
    expect(setReps({ w: 60, r: 5, done: true })).toBe(5)
  })

  it('çift taraflıyı tek taraflıya çevirirken tekrar ve durumu iki tarafa kopyalar', () => {
    const [s] = toUnilateral([{ w: 20, r: 10, done: true }])
    expect(s.sides).toEqual(makeSides(10, true))
  })

  it('zaten tek taraflı olanı bozmaz', () => {
    const s = deriveSet(uni(10, 8))
    expect(toUnilateral([s])[0]).toBe(s)
  })

  it('tek taraflıdan dönerken zayıf taraf tekrarını ve done durumunu korur', () => {
    const [s] = toBilateral([uni(10, 8, true, false)])
    expect(s.sides).toBeUndefined()
    expect(s.r).toBe(8)
    expect(s.done).toBe(false)
  })
})

describe('formatSet', () => {
  it('çift taraflı seti kısa yazar', () => {
    expect(formatSet({ w: 60, r: 8, done: true, rir: 2 }, '60')).toBe('60×8 @2')
  })

  it('tek taraflı seti sol/sağ ayrı yazar', () => {
    expect(formatSet(uni(10, 8), '20')).toBe('20×L10/R8')
  })
})
