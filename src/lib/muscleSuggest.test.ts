import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { withMuscleFixes, type Exercise } from './exercises.ts'
import { MAX_SUGGESTIONS, suggestExercises } from './muscleSuggest.ts'

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  level: 'beginner',
  equipment: 'barbell',
  category: 'strength',
  primaryMuscles: ['glutes'],
  secondaryMuscles: [],
  instructions: [],
  images: [],
  ...over,
})

const workout = (d: string, ...entries: Array<[string, boolean?]>): Workout => ({
  id: d + entries.map((e) => e[0]).join(),
  d,
  start: 0,
  name: 'Test',
  entries: entries.map(([exId, done = true]) => ({ exId, sets: [{ w: 50, r: 8, done }] })),
})

const ids = (r: ReturnType<typeof suggestExercises>) => r.map((s) => s.ex.id)

describe('suggestExercises', () => {
  it('yalnız kasın birincil olduğu egzersizleri önerir (yardımcı kas yetmez)', () => {
    const list = [
      ex('a'),
      ex('b', { primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes'] }),
      ex('c', { primaryMuscles: ['hamstrings', 'glutes'] }),
    ]
    expect(ids(suggestExercises('glutes', list, [])).sort()).toEqual(['a', 'c'])
  })

  it('en fazla 5 öneri verir; limit verilebilir', () => {
    const list = Array.from({ length: 12 }, (_, i) => ex(`e${i}`))
    expect(MAX_SUGGESTIONS).toBe(5)
    expect(suggestExercises('glutes', list, [])).toHaveLength(5)
    expect(suggestExercises('glutes', list, [], 2)).toHaveLength(2)
    expect(suggestExercises('glutes', list, [], 0)).toEqual([])
  })

  it('kas için egzersiz yoksa boş döner', () => {
    expect(suggestExercises('neck', [ex('a')], [])).toEqual([])
    expect(suggestExercises('neck', [], [])).toEqual([])
  })

  it('geçmişte yapılanlar öne gelir; çok yapılan, sonra yakın tarihli önce', () => {
    const list = [ex('a'), ex('b'), ex('c'), ex('d')]
    const ws = [
      workout('2026-09-01', ['c']),
      workout('2026-09-10', ['b']),
      workout('2026-09-12', ['c']),
      workout('2026-09-20', ['d']),
    ]
    const r = suggestExercises('glutes', list, ws)
    expect(ids(r)).toEqual(['c', 'd', 'b', 'a'])
    expect(r.map((s) => s.timesDone)).toEqual([2, 1, 1, 0])
  })

  it('aynı antrenmanda iki kez geçen egzersiz bir kez sayılır; yapılmamış ve ısınma seti sayılmaz', () => {
    const list = [ex('a'), ex('b')]
    const ws: Workout[] = [
      workout('2026-09-01', ['a'], ['a']),
      workout('2026-09-02', ['b', false]),
      {
        ...workout('2026-09-03', ['b']),
        entries: [{ exId: 'b', sets: [{ w: 20, r: 10, done: true, warmup: true }] }],
      },
    ]
    const r = suggestExercises('glutes', list, ws)
    expect(r.find((s) => s.ex.id === 'a')?.timesDone).toBe(1)
    expect(r.find((s) => s.ex.id === 'b')?.timesDone).toBe(0)
    expect(ids(r)[0]).toBe('a')
  })

  it('yapılmamışlarda ekipman çeşitliliği gözetilir, yaygın ekipman önce gelir', () => {
    const list = [
      ex('b1', { equipment: 'barbell' }),
      ex('b2', { equipment: 'barbell' }),
      ex('b3', { equipment: 'barbell' }),
      ex('c1', { equipment: 'cable' }),
      ex('c2', { equipment: 'cable' }),
      ex('m1', { equipment: 'machine' }),
    ]
    expect(ids(suggestExercises('glutes', list, []))).toEqual(['b1', 'c1', 'm1', 'b2', 'c2'])
  })

  it('yapılmış egzersizin ekipmanı çeşitlilikte sayılır', () => {
    const list = [
      ex('b1', { equipment: 'barbell' }),
      ex('b2', { equipment: 'barbell' }),
      ex('c1', { equipment: 'cable' }),
    ]
    const r = suggestExercises('glutes', list, [workout('2026-09-01', ['b2'])], 2)
    expect(ids(r)).toEqual(['b2', 'c1'])
  })

  it('germe, kardiyo ve pliometrik egzersizleri yeni öneriye almaz; özel egzersiz ve yapılmış olanlar girer', () => {
    const list = [
      ex('s', { category: 'stretching' }),
      ex('k', { category: 'cardio' }),
      ex('p', { category: 'plyometrics' }),
      ex('o', { category: 'olympic weightlifting' }),
      ex('pl', { category: 'powerlifting' }),
      ex('mine', { category: 'strength', custom: true }),
    ]
    expect(ids(suggestExercises('glutes', list, [])).sort()).toEqual(['mine', 'pl'])
    expect(ids(suggestExercises('glutes', list, [workout('2026-09-01', ['s'])]))[0]).toBe('s')
  })

  it('kolay seviye ve ad sırası eşitliği bozar', () => {
    const list = [
      ex('z', { name: 'Zeta', level: 'beginner' }),
      ex('a', { name: 'Alfa', level: 'expert' }),
      ex('m', { name: 'Mid', level: 'intermediate' }),
      ex('b', { name: 'Beta', level: 'beginner' }),
    ]
    expect(ids(suggestExercises('glutes', list, []))).toEqual(['b', 'z', 'm', 'a'])
  })

  it('deterministik: girdi sırası ya da tekrar çağrı sonucu değiştirmez', () => {
    const list = Array.from({ length: 14 }, (_, i) =>
      ex(`e${i}`, { name: `Ex ${i % 5}`, equipment: ['barbell', 'cable', 'machine', null][i % 4] }),
    )
    const ws = [workout('2026-09-01', ['e3']), workout('2026-09-02', ['e7'])]
    const a = ids(suggestExercises('glutes', list, ws))
    expect(ids(suggestExercises('glutes', list, ws))).toEqual(a)
    expect(ids(suggestExercises('glutes', [...list].reverse(), [...ws].reverse()))).toEqual(a)
  })

  it('girdileri değiştirmez', () => {
    const list = [ex('b'), ex('a')]
    const ws = [workout('2026-09-01', ['a'])]
    const before = structuredClone({ list, ws })
    suggestExercises('glutes', list, ws)
    expect({ list, ws }).toEqual(before)
  })

  it('kas düzeltmesi uygulanmış listede düzeltilmiş kasa göre önerir', () => {
    const base = [
      ex('hip', { primaryMuscles: ['quadriceps'] }),
      ex('bridge', { primaryMuscles: ['glutes'] }),
    ]
    const fixed = withMuscleFixes(base, { hip: { primary: ['glutes'], secondary: [] }, bridge: { primary: ['hamstrings'], secondary: [] } })
    expect(ids(suggestExercises('glutes', fixed, []))).toEqual(['hip'])
    expect(ids(suggestExercises('quadriceps', fixed, []))).toEqual([])
    expect(ids(suggestExercises('hamstrings', fixed, []))).toEqual(['bridge'])
  })

  it('geçmişte yapılan egzersiz düzeltmeyle başka kasa geçtiyse eski kasta önerilmez', () => {
    const fixed = withMuscleFixes([ex('hip', { primaryMuscles: ['quadriceps'] })], {
      hip: { primary: ['glutes'], secondary: [] },
    })
    const ws = [workout('2026-09-01', ['hip'])]
    expect(suggestExercises('quadriceps', fixed, ws)).toEqual([])
    expect(suggestExercises('glutes', fixed, ws)[0].timesDone).toBe(1)
  })
})
