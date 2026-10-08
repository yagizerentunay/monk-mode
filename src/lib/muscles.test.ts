import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import { MUSCLES, MUSCLE_LABEL, emptyMuscleSets, muscleLevel, muscleSets, sinceDay } from './muscles.ts'

const set = (over: Partial<SetEntry> = {}): SetEntry => ({ w: 50, r: 8, done: true, ...over })

const workout = (d: string, entries: Workout['entries']): Workout => ({
  id: d,
  d,
  start: 0,
  name: 'Test',
  entries,
})

const byId = new Map([
  ['bench', { primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'] }],
  ['curl', { primaryMuscles: ['biceps'] }],
  ['odd', { primaryMuscles: ['chest', 'chest'], secondaryMuscles: ['chest', 'triceps', 'triceps', 'bilinmeyen'] }],
])

const all = { from: '2000-01-01' }

describe('kas listesi', () => {
  it('17 kasın hepsinin benzersiz kısa Türkçe etiketi var', () => {
    expect(MUSCLES).toHaveLength(17)
    const labels = MUSCLES.map((m) => MUSCLE_LABEL[m])
    expect(new Set(labels).size).toBe(17)
    for (const l of labels) expect(l.length).toBeLessThanOrEqual(16)
  })

  it('boş küme tüm kaslar için sıfırdır', () => {
    const e = emptyMuscleSets()
    expect(Object.keys(e)).toHaveLength(17)
    expect(Object.values(e).every((v) => v === 0)).toBe(true)
  })
})

describe('kas başına set', () => {
  it('birincil kasa 1, ikincil kasa 0,5 set yazar', () => {
    const r = muscleSets([workout('2026-10-05', [{ exId: 'bench', sets: [set(), set(), set()] }])], byId, all)
    expect(r.chest).toBe(3)
    expect(r.triceps).toBe(1.5)
    expect(r.shoulders).toBe(1.5)
    expect(r.biceps).toBe(0)
  })

  it('ısınma ve yapılmamış setleri saymaz', () => {
    const sets = [set({ warmup: true }), set({ done: false }), set()]
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', sets }])], byId, all)
    expect(r.biceps).toBe(1)
  })

  it('dropsetleri her biri bir set olarak sayar', () => {
    const sets = [set(), set({ drop: true }), set({ drop: true })]
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', sets }])], byId, all)
    expect(r.biceps).toBe(3)
  })

  it('tek taraflı seti iki değil bir set sayar', () => {
    const uni = set({
      sides: { L: { r: 10, done: true }, R: { r: 10, done: true } },
    })
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', unilateral: true, sets: [uni, uni] }])], byId, all)
    expect(r.biceps).toBe(2)
  })

  it('tarih aralığının iki ucunu da içerir, dışını saymaz', () => {
    const e = (d: string) => workout(d, [{ exId: 'curl', sets: [set()] }])
    const ws = [e('2026-10-01'), e('2026-10-02'), e('2026-10-05'), e('2026-10-08'), e('2026-10-09')]
    const r = muscleSets(ws, byId, { from: '2026-10-02', to: '2026-10-08' })
    expect(r.biceps).toBe(3)
  })

  it('üst sınır verilmezse sınırsızdır', () => {
    const ws = [workout('2099-01-01', [{ exId: 'curl', sets: [set()] }])]
    expect(muscleSets(ws, byId, { from: '2026-10-01' }).biceps).toBe(1)
  })

  it('bilinmeyen egzersizi ve bilinmeyen kas adını sessizce yok sayar', () => {
    const ws = [
      workout('2026-10-05', [
        { exId: 'yok', sets: [set()] },
        { exId: 'odd', sets: [set()] },
      ]),
    ]
    const r = muscleSets(ws, byId, all)
    expect(r.chest).toBe(1)
    expect(Object.keys(r)).toHaveLength(17)
  })

  it('hem birincil hem ikincil kası yalnız birincil sayar, tekrarlı adı bir kez sayar', () => {
    const r = muscleSets([workout('2026-10-05', [{ exId: 'odd', sets: [set(), set()] }])], byId, all)
    expect(r.chest).toBe(2)
    expect(r.triceps).toBe(1)
  })

  it('girdileri değiştirmez', () => {
    const ws = [workout('2026-10-05', [{ exId: 'bench', sets: [set(), set({ warmup: true })] }])]
    const snap = JSON.stringify(ws)
    const map = new Map([['bench', { primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] }]])
    muscleSets(ws, map, all)
    expect(JSON.stringify(ws)).toBe(snap)
    expect(map.get('bench')).toEqual({ primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] })
  })
})

describe('pencere başlangıcı', () => {
  it('7 gün bugün dahil 6 gün geriye gider', () => {
    expect(sinceDay(7, new Date(2026, 9, 8))).toBe('2026-10-02')
  })

  it('ay sınırını geçer', () => {
    expect(sinceDay(7, new Date(2026, 9, 3))).toBe('2026-09-27')
  })

  it('1 günden küçük değer 1 sayılır', () => {
    expect(sinceDay(0, new Date(2026, 9, 8))).toBe('2026-10-08')
    expect(sinceDay(-3, new Date(2026, 9, 8))).toBe('2026-10-08')
  })
})

describe('kas ısısı', () => {
  it('7 günde 10 set tam ısıdır, yarısı 0,5 verir', () => {
    expect(muscleLevel(10, 7)).toBe(1)
    expect(muscleLevel(5, 7)).toBe(0.5)
  })

  it('hedefin üstünü 1 değerine sıkıştırır', () => {
    expect(muscleLevel(25, 7)).toBe(1)
  })

  it('30 günde hedef orantılı büyür', () => {
    expect(muscleLevel(30, 30)).toBeCloseTo(30 / ((10 * 30) / 7))
    expect(muscleLevel(100, 30)).toBe(1)
  })

  it('geçersiz girdide 0 verir', () => {
    expect(muscleLevel(5, 0)).toBe(0)
    expect(muscleLevel(5, -7)).toBe(0)
    expect(muscleLevel(Number.NaN, 7)).toBe(0)
    expect(muscleLevel(5, Number.POSITIVE_INFINITY)).toBe(0)
    expect(muscleLevel(-2, 7)).toBe(0)
  })
})
