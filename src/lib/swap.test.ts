import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutEntry } from '../store/schema.ts'
import type { Exercise } from './exercises.ts'
import { alternativesFor, hasCompletedWork, MAX_ALTERNATIVES, swapEntry } from './swap.ts'

const ex = (id: string, name: string, muscles: string[], equipment: string | null, custom?: boolean): Exercise => ({
  id,
  name,
  level: 'beginner',
  equipment,
  category: 'strength',
  primaryMuscles: muscles,
  secondaryMuscles: [],
  instructions: [],
  images: [],
  ...(custom ? { custom } : {}),
})

const bench = ex('bench', 'Barbell Bench Press', ['chest'], 'barbell')
const all = [
  bench,
  ex('db', 'Dumbbell Bench Press', ['chest'], 'dumbbell'),
  ex('bb2', 'Wide Grip Bench', ['chest'], 'barbell'),
  ex('bb3', 'Close Grip Bench', ['chest'], 'barbell'),
  ex('fly', 'Cable Fly', ['chest'], 'cable'),
  ex('curl', 'Barbell Curl', ['biceps'], 'barbell'),
  ex('sec', 'Dips', ['triceps', 'chest'], 'body only'),
  ex('mine', 'Benim Press', ['chest'], 'barbell', true),
]

describe('alternativesFor', () => {
  it('yalnız aynı ilk kasa bakar; kendisini ve hariç tutulanları çıkarır', () => {
    const ids = alternativesFor(bench, all, new Set(['fly'])).map((e) => e.id)
    expect(ids).not.toContain('bench')
    expect(ids).not.toContain('fly')
    expect(ids).not.toContain('curl')
    expect(ids).not.toContain('sec')
    expect(ids).toContain('db')
  })

  it('aynı ekipmanı önce, sonra ada göre sıralar; özel egzersiz katılır', () => {
    const ids = alternativesFor(bench, all, new Set()).map((e) => e.id)
    expect(ids).toEqual(['mine', 'bb3', 'bb2', 'fly', 'db'])
  })

  it('usedIds verilirse yapılmış olanlar kendi ekipman grubunda öne geçer', () => {
    const ids = alternativesFor(bench, all, new Set(), new Set(['bb2', 'db'])).map((e) => e.id)
    expect(ids).toEqual(['bb2', 'mine', 'bb3', 'db', 'fly'])
  })

  it('sınır uygular ve kassız egzersizde boş döner', () => {
    const many = Array.from({ length: 50 }, (_, i) => ex(`x${i}`, `Press ${String(i).padStart(2, '0')}`, ['chest'], 'barbell'))
    expect(alternativesFor(bench, many, new Set())).toHaveLength(MAX_ALTERNATIVES)
    expect(alternativesFor(ex('n', 'N', [], null), all, new Set())).toEqual([])
  })
})

const entry = (over: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  exId: 'bench',
  note: 'omuz ağrısı',
  linked: true,
  sets: [
    { w: 40, r: 8, done: false, warmup: true },
    { w: 100, r: 5, done: false },
    { w: 100, r: 5, done: false },
    { w: 80, r: 5, done: false, drop: true },
  ],
  ...over,
})

const history = (exId: string, w: number, r: number, doneAll = true): Workout[] => [
  {
    id: 'h',
    d: '2026-01-01',
    start: 1,
    name: 'x',
    entries: [{ exId, sets: [{ w, r, done: doneAll }, { w, r, done: doneAll }] }],
  },
]

describe('swapEntry', () => {
  it('tamamlanmış ya da yarım set varsa null döner', () => {
    const done = entry()
    done.sets[1] = { ...done.sets[1], done: true }
    expect(swapEntry(done, 'db', false, [])).toBeNull()
    const half = entry()
    half.sets[1] = { ...half.sets[1], partial: true }
    expect(hasCompletedWork(half)).toBe(true)
    expect(swapEntry(half, 'db', false, [])).toBeNull()
  })

  it('geçmişi yoksa ağırlığı ve tekrarı korur, yapıyı ve süpersetı korur, notu siler', () => {
    const out = swapEntry(entry(), 'db', false, [])!
    expect(out.exId).toBe('db')
    expect(out.note).toBeUndefined()
    expect(out.linked).toBe(true)
    expect(out.sets.map((s) => [!!s.warmup, !!s.drop, s.w, s.r])).toEqual([
      [true, false, 40, 8],
      [false, false, 100, 5],
      [false, false, 100, 5],
      [false, true, 80, 5],
    ])
  })

  it('yeni egzersizin geçmişinden hedef çıkarır; ısınma ve drop yeniden hesaplanır', () => {
    const out = swapEntry(entry(), 'db', false, history('db', 30, 5, true))!
    const work = out.sets.filter((s) => !s.warmup && !s.drop)
    expect(work).toHaveLength(2)
    // tüm setler hedef tekrara ulaştı → ağırlık artar
    expect(work.every((s) => s.w === 32.5 && s.r === 5)).toBe(true)
    expect(out.sets[0]).toMatchObject({ warmup: true, w: 13 })
    expect(out.sets[3]).toMatchObject({ drop: true, w: 25 })
    expect(out.sets.every((s) => !s.done)).toBe(true)
  })

  it('tek taraflılığı side ile belirler ve setleri tutarlı tutar', () => {
    const uni = swapEntry(entry(), 'lunge', true, [])!
    expect(uni.unilateral).toBe(true)
    expect(uni.sets[0].sides).toBeUndefined() // ısınma tek satır
    expect(uni.sets[1].sides).toEqual({ L: { r: 5, done: false }, R: { r: 5, done: false } })
    expect(uni.sets[3].sides).toBeDefined()
    const back = swapEntry(entry({ unilateral: true }), 'db', false, [])!
    expect(back.unilateral).toBeUndefined()
    expect(back.sets.every((s) => !s.sides)).toBe(true)
  })

  it('girdiyi değiştirmez', () => {
    const e = entry()
    const snap = JSON.stringify(e)
    swapEntry(e, 'db', true, [])
    expect(JSON.stringify(e)).toBe(snap)
  })
})

describe('hasCompletedWork', () => {
  it('tek tarafı işaretlenmiş sol/sağ seti de iş sayar', () => {
    const e = entry({ unilateral: true })
    e.sets = [{ w: 10, r: 5, done: false, sides: { L: { r: 5, done: true }, R: { r: 5, done: false } } }]
    expect(hasCompletedWork(e)).toBe(true)
    expect(swapEntry(e, 'db', true, [])).toBeNull()
  })
})
