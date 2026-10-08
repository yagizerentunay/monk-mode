import { describe, expect, it } from 'vitest'
import type { SetEntry, WorkoutEntry } from '../store/schema.ts'
import { groupLetter, restAfter, supersetInfo } from './superset.ts'

describe('süperset grupları', () => {
  it('bağlı ardışık egzersizleri grupla, yalnızları null bırak', () => {
    expect(supersetInfo([false, true, false, true, true, false])).toEqual([
      { group: 0, pos: 0, size: 2 },
      { group: 0, pos: 1, size: 2 },
      { group: 1, pos: 0, size: 3 },
      { group: 1, pos: 1, size: 3 },
      { group: 1, pos: 2, size: 3 },
      null,
    ])
  })

  it('bağsız listede ve boş listede grup yok', () => {
    expect(supersetInfo([false, undefined, false])).toEqual([null, null, null])
    expect(supersetInfo([])).toEqual([])
  })

  it('ilk egzersizin bayrağı yok sayılır ama devamı grubu kurar', () => {
    expect(supersetInfo([true, true])).toEqual([
      { group: 0, pos: 0, size: 2 },
      { group: 0, pos: 1, size: 2 },
    ])
    expect(supersetInfo([true])).toEqual([null])
  })

  it('grup harflerini üretir', () => {
    expect(groupLetter(0)).toBe('A')
    expect(groupLetter(25)).toBe('Z')
    expect(groupLetter(26)).toBe('AA')
  })
})

const work = (done = false): SetEntry => ({ w: 20, r: 8, done })
const entry = (sets: SetEntry[], linked = false): WorkoutEntry => ({ exId: 'x', sets, linked })

describe('süpersette dinlenme', () => {
  it('bağsız egzersizde normal dinlenme verir', () => {
    expect(restAfter([entry([work(), work()])], 0, 0, 90)).toBe(90)
  })

  it('partnerin aynı sıradaki seti bekliyorsa dinlenmeden ona geçer', () => {
    const entries = [entry([work(true), work()]), entry([work(), work()], true)]
    expect(restAfter(entries, 0, 0, 90)).toBeNull()
  })

  it('turun sonunda (son egzersiz) dinlenme başlar', () => {
    const entries = [entry([work(true), work()]), entry([work(true), work()], true)]
    expect(restAfter(entries, 1, 0, 90)).toBe(90)
  })

  it('ikinci turda da aynı düzen sürer', () => {
    const entries = [entry([work(true), work(true)]), entry([work(true), work()], true)]
    expect(restAfter(entries, 0, 1, 90)).toBeNull()
    expect(restAfter(entries, 1, 0, 90)).toBe(90)
  })

  it('partnerin o seti yoksa tur bitmiş sayılır ve dinlenir', () => {
    const entries = [entry([work(), work(), work(true)]), entry([work(true), work(true)], true)]
    expect(restAfter(entries, 0, 2, 90)).toBe(90)
  })

  it('partnerin o seti zaten yapıldıysa (sıra dışı) dinlenir', () => {
    const entries = [entry([work()]), entry([work(true)], true)]
    expect(restAfter(entries, 0, 0, 90)).toBe(90)
  })

  it('üçlü sette ortadaki set de bir sonrakine geçirir, sonuncu dinlenir', () => {
    const entries = [entry([work(true)]), entry([work(true)], true), entry([work()], true)]
    expect(restAfter(entries, 1, 0, 90)).toBeNull()
    expect(restAfter([entry([work(true)]), entry([work(true)], true), entry([work(true)], true)], 2, 0, 90)).toBe(90)
  })

  it('ısınma seti kısa dinlenir, süperset beklemez', () => {
    const entries = [entry([{ w: 10, r: 8, done: true, warmup: true }, work()]), entry([work()], true)]
    expect(restAfter(entries, 0, 0, 90)).toBe(45)
  })

  it('arkasında drop olan sette dinlenme yok; drop ardından partner bekliyorsa yine yok', () => {
    const drop: SetEntry = { w: 16, r: 8, done: true, drop: true }
    const partner = entry([work()], true)
    expect(restAfter([entry([work(true), drop]), partner], 0, 0, 90)).toBeNull()
    expect(restAfter([entry([work(true), drop]), partner], 0, 1, 90)).toBeNull()
    expect(restAfter([entry([work(true), drop]), entry([work(true)], true)], 0, 1, 90)).toBe(90)
  })
})
