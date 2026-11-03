import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { liveRecord } from './livePr.ts'
import { estimate1RM } from './onerm.ts'

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })
const entry = (sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({ exId: 'bench', sets, ...extra })
const history = (...sets: SetEntry[]): Workout[] => [
  { id: 'h', d: '2026-10-01', start: 1, name: 'A', entries: [entry(sets)] },
]

describe('liveRecord', () => {
  it('önceki en iyiyi geçen seti yeni tahmini 1RM ile bildirir', () => {
    const prev = history(set(80, 5))
    expect(liveRecord(prev, entry([set(85, 5)]), 0)).toBeCloseTo(estimate1RM(85, 5))
  })

  it('eşit ya da düşük sette bildirmez', () => {
    const prev = history(set(80, 5))
    expect(liveRecord(prev, entry([set(80, 5)]), 0)).toBeUndefined()
    expect(liveRecord(prev, entry([set(70, 5)]), 0)).toBeUndefined()
  })

  it('geçmişi olmayan egzersizde bildirmez', () => {
    expect(liveRecord([], entry([set(100, 5)]), 0)).toBeUndefined()
  })

  it('aynı seansta daha önce bildirilen değeri tekrar bildirmez, daha da yükseği bildirir', () => {
    const prev = history(set(80, 5))
    const e = entry([set(85, 5), set(85, 5), set(90, 5)])
    expect(liveRecord(prev, e, 1)).toBeUndefined()
    expect(liveRecord(prev, e, 2)).toBeCloseTo(estimate1RM(90, 5))
  })

  it('ısınma, dropset, yarım ve yapılmamış seti saymaz', () => {
    const prev = history(set(80, 5))
    for (const extra of [{ warmup: true }, { drop: true }, { partial: true }, { done: false }] as Partial<SetEntry>[]) {
      expect(liveRecord(prev, entry([set(100, 5, extra)]), 0)).toBeUndefined()
    }
    expect(liveRecord(prev, entry([set(100, 5)]), 3)).toBeUndefined()
  })

  it('RIR girilmişse RIR\'li tahminle karşılaştırır', () => {
    const prev = history(set(80, 5, { rir: 0 }))
    expect(liveRecord(prev, entry([set(80, 5, { rir: 2 })]), 0)).toBeCloseTo(estimate1RM(80, 5, 2))
  })

  it('süreli ve mesafe egzersizinde bildirmez', () => {
    const prev = history(set(0, 30))
    expect(liveRecord(prev, entry([set(0, 60)], { timed: true }), 0)).toBeUndefined()
    expect(liveRecord(prev, entry([set(0, 600, { m: 2000 })], { distance: true }), 0)).toBeUndefined()
  })
})
