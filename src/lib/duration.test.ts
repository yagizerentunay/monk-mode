import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { MIN_DURATION_SESSIONS, typicalDurationMin } from './duration.ts'
import { dayString } from './workout.ts'

const MIN = 60000
const at = (day: number, hour = 18) => new Date(2026, 9, day, hour, 0, 0).getTime()

const wk = (i: number, minutes: number | undefined, extra: Partial<Workout> = {}): Workout => {
  const start = at(i + 1)
  return {
    id: String(i),
    d: dayString(new Date(start)),
    start,
    ...(minutes !== undefined ? { end: start + minutes * MIN } : {}),
    routineId: 'push',
    name: 'Push',
    entries: [],
    ...extra,
  }
}

describe('typicalDurationMin', () => {
  it('az geçmişte tahmin vermez', () => {
    expect(MIN_DURATION_SESSIONS).toBe(2)
    expect(typicalDurationMin([], 'push')).toBeUndefined()
    expect(typicalDurationMin([wk(0, 60)], 'push')).toBeUndefined()
  })

  it('aynı rutinin seanslarının medyanını 5 dakikaya yuvarlar', () => {
    expect(typicalDurationMin([wk(0, 60), wk(1, 70)], 'push')).toBe(65)
    expect(typicalDurationMin([wk(0, 58), wk(1, 63), wk(2, 90)], 'push')).toBe(65)
  })

  it('yalnız son 5 seansa bakar', () => {
    const old = [wk(0, 200), wk(1, 200)]
    const recent = [2, 3, 4, 5, 6].map((i) => wk(i, 50))
    expect(typicalDurationMin([...old, ...recent], 'push')).toBe(50)
  })

  it('başka rutini, bitişi olmayanı ve aralık dışı süreyi saymaz', () => {
    const other = wk(0, 40, { routineId: 'pull' })
    const open = wk(1, undefined)
    const tiny = wk(2, 3)
    const left = wk(3, 600)
    expect(typicalDurationMin([other, open, tiny, left, wk(4, 60)], 'push')).toBeUndefined()
    expect(typicalDurationMin([other, open, tiny, left, wk(4, 60), wk(5, 80)], 'push')).toBe(70)
  })

  it('geçmiş güne girilen (başlangıcı kayıt gününe uymayan) seansı saymaz', () => {
    const backdated = wk(0, 60, { d: '2026-01-01' })
    expect(typicalDurationMin([backdated, wk(1, 60)], 'push')).toBeUndefined()
  })

  it('en kısa geçerli süre (10 dk) kendi değerinde kalır', () => {
    expect(typicalDurationMin([wk(0, 10), wk(1, 10)], 'push')).toBe(10)
  })
})
