import { describe, expect, it } from 'vitest'
import type { CustomExercise, Workout } from '../store/schema.ts'
import type { ImportedEntry, ImportedWorkout, ParsedImport } from './importTypes.ts'
import { buildImport, type NameMatcher } from './importWorkouts.ts'

const entry = (name: string, sets: ImportedEntry['sets'], supersetId?: string): ImportedEntry => ({
  name,
  sets,
  supersetId,
})
const normal = (weight: number, reps: number) => ({ type: 'normal' as const, weight, reps })
const iw = (start: number, entries: ImportedEntry[], name = 'Üst'): ImportedWorkout => ({
  name,
  start,
  date: '2026-10-01',
  entries,
})
const parsed = (workouts: ImportedWorkout[]): ParsedImport => ({
  format: 'strong',
  unit: 'kg',
  workouts,
  skippedRows: 0,
  warnings: [],
})

const library: Record<string, { id: string; name: string }> = {
  'bench press (barbell)': { id: 'bench', name: 'Barbell Bench Press' },
  'pull up': { id: 'pullups', name: 'Pullups' },
}
const match: NameMatcher = (n) => library[n.trim().toLowerCase()] ?? null

describe('içe aktarma planı', () => {
  it('kütüphane eşleşmesini kullanır, eşleşmeyeni özel egzersiz yapar', () => {
    const plan = buildImport(
      parsed([iw(1, [entry('Bench Press (Barbell)', [normal(60, 8)]), entry('Zottaria Curl', [normal(10, 12)])])]),
      'kg',
      match,
      [],
      [],
    )
    expect(plan.workouts[0].entries[0].exId).toBe('bench')
    expect(plan.newCustom).toHaveLength(1)
    expect(plan.newCustom[0]).toMatchObject({ name: 'Zottaria Curl', primaryMuscles: [] })
    expect(plan.workouts[0].entries[1].exId).toBe(plan.newCustom[0].id)
    expect(plan.mappings.map((m) => [m.name, m.custom])).toEqual([
      ['Bench Press (Barbell)', false],
      ['Zottaria Curl', true],
    ])
  })

  it('aynı eşleşmeyen adı tüm antrenmanlarda tek özel egzersizde toplar, büyük/küçük harfe bakmaz', () => {
    const plan = buildImport(
      parsed([iw(1, [entry('Foo', [normal(5, 5)])]), iw(2, [entry('foo ', [normal(5, 5)])])]),
      'kg',
      match,
      [],
      [],
    )
    expect(plan.newCustom).toHaveLength(1)
    expect(plan.workouts[0].entries[0].exId).toBe(plan.workouts[1].entries[0].exId)
  })

  it('daha önce oluşturulmuş aynı adlı özel egzersizi yeniden kullanır', () => {
    const old: CustomExercise = { id: 'custom-1', name: 'Foo', primaryMuscles: [], equipment: '' }
    const plan = buildImport(parsed([iw(1, [entry('foo', [normal(5, 5)])])]), 'kg', match, [], [old])
    expect(plan.newCustom).toHaveLength(0)
    expect(plan.workouts[0].entries[0].exId).toBe('custom-1')
  })

  it('lb ağırlığı kg\'a çevirir, kg\'ı olduğu gibi bırakır', () => {
    const lb = buildImport(parsed([iw(1, [entry('Pull Up', [normal(135, 5)])])]), 'lb', match, [], [])
    expect(lb.workouts[0].entries[0].sets[0].w).toBe(61.24)
    const kg = buildImport(parsed([iw(1, [entry('Pull Up', [normal(62.5, 5)])])]), 'kg', match, [], [])
    expect(kg.workouts[0].entries[0].sets[0].w).toBe(62.5)
  })

  it('çevrilen ağırlıkta kayan nokta artığı bırakmaz', () => {
    const plan = buildImport(parsed([iw(1, [entry('Pull Up', [normal(115, 6)])])]), 'lb', match, [], [])
    expect(plan.workouts[0].entries[0].sets[0].w).toBe(52.16)
  })

  it('ısınma ve drop işaretlerini taşır, setleri tamamlanmış yapar', () => {
    const plan = buildImport(
      parsed([
        iw(1, [
          entry('Pull Up', [
            { type: 'warmup', weight: 20, reps: 8 },
            normal(40, 5),
            { type: 'drop', weight: 30, reps: 6 },
          ]),
        ]),
      ]),
      'kg',
      match,
      [],
      [],
    )
    expect(plan.workouts[0].entries[0].sets).toEqual([
      { w: 20, r: 8, done: true, warmup: true },
      { w: 40, r: 5, done: true },
      { w: 30, r: 6, done: true, drop: true },
    ])
  })

  it('yalnız ısınması olan egzersizi almaz, boşalan antrenmanı atar', () => {
    const plan = buildImport(
      parsed([iw(1, [entry('Pull Up', [{ type: 'warmup', weight: 20, reps: 8 }])])]),
      'kg',
      match,
      [],
      [],
    )
    expect(plan.workouts).toHaveLength(0)
    expect(plan.newCustom).toHaveLength(0)
  })

  it('aynı başlangıç ve adla kayıtlı antrenmanı atlar', () => {
    const existing: Workout[] = [{ id: 'x', d: '2026-10-01', start: 1, name: 'Üst', entries: [] }]
    const plan = buildImport(parsed([iw(1, [entry('Pull Up', [normal(0, 8)])]), iw(2, [entry('Pull Up', [normal(0, 8)])])]), 'kg', match, existing, [])
    expect(plan.duplicates).toBe(1)
    expect(plan.workouts).toHaveLength(1)
    expect(plan.workouts[0].start).toBe(2)
  })

  it('ardışık aynı süperset kimliğini bağlar, farklı olanı bağlamaz', () => {
    const plan = buildImport(
      parsed([
        iw(1, [
          entry('Pull Up', [normal(0, 8)], 'a'),
          entry('Bench Press (Barbell)', [normal(60, 8)], 'a'),
          entry('Foo', [normal(5, 5)], 'b'),
          entry('Bar', [normal(5, 5)]),
        ]),
      ]),
      'kg',
      match,
      [],
      [],
    )
    expect(plan.workouts[0].entries.map((e) => !!e.linked)).toEqual([false, true, false, false])
  })

  it('süreyi bitiş zamanına çevirir ve set sayısını toplar', () => {
    const w = iw(1000, [entry('Pull Up', [normal(0, 8), normal(0, 8)])])
    w.durationSec = 60
    const plan = buildImport(parsed([w]), 'kg', match, [], [])
    expect(plan.workouts[0].end).toBe(61000)
    expect(plan.sets).toBe(2)
  })
})
