import { describe, expect, it } from 'vitest'
import { defaultState, type CustomExercise, type Routine, type State, type Workout } from '../store/schema.ts'
import { mergeState, totalAdded } from './mergeBackup.ts'

const wk = (id: string, d: string, start: number, over: Partial<Workout> = {}): Workout => ({
  id,
  d,
  start,
  end: start + 3_600_000,
  name: 'Push',
  entries: [{ exId: 'bench', sets: [{ w: 60, r: 5, done: true }] }],
  ...over,
})
const routine = (id: string, name: string, weight = 20): Routine => ({
  id,
  name,
  ex: [{ exId: 'bench', sets: 3, reps: 8, weight, prog: 'double', inc: 2.5, repsMax: 12 }],
})
const custom = (id: string, name: string): CustomExercise => ({ id, name, primaryMuscles: [], equipment: '' })
const st = (over: Partial<State> = {}): State => ({ ...defaultState(), ...over })

describe('mergeState: antrenmanlar', () => {
  it('kimliğe göre birleşim; (d, start) sırasına dizer', () => {
    const local = st({ workouts: [wk('a', '2026-01-02', 200), wk('c', '2026-01-04', 100)] })
    const incoming = st({ workouts: [wk('b', '2026-01-03', 900), wk('d', '2026-01-02', 100)] })
    const { state, report } = mergeState(local, incoming)
    expect(state.workouts.map((w) => w.id)).toEqual(['d', 'a', 'b', 'c'])
    expect(report.workouts).toEqual({ added: 2, identical: 0, conflicting: 0 })
  })

  it('aynı kimlik ve aynı içerik: zaten vardı (anahtar sırası önemsiz)', () => {
    const a = wk('a', '2026-01-02', 200)
    const reordered = JSON.parse(
      JSON.stringify({ name: a.name, start: a.start, id: a.id, entries: a.entries, end: a.end, d: a.d }),
    ) as Workout
    const { state, report } = mergeState(st({ workouts: [a] }), st({ workouts: [reordered] }))
    expect(state.workouts).toHaveLength(1)
    expect(report.workouts).toEqual({ added: 0, identical: 1, conflicting: 0 })
  })

  it('aynı kimlik ama farklı içerik: yerel korunur, çakışma sayılır', () => {
    const mine = wk('a', '2026-01-02', 200, { note: 'yerel' })
    const theirs = wk('a', '2026-01-02', 200, {
      note: 'uzak',
      entries: [{ exId: 'bench', sets: [{ w: 80, r: 3, done: true }] }],
    })
    const { state, report } = mergeState(st({ workouts: [mine] }), st({ workouts: [theirs] }))
    expect(state.workouts).toEqual([mine])
    expect(report.workouts).toEqual({ added: 0, identical: 0, conflicting: 1 })
  })

  it('kimliği farklı, gün + başlangıç + egzersizler aynı: kopya sayılır, eklenmez', () => {
    const mine = wk('a', '2026-01-02', 200)
    const copy = wk('zzz', '2026-01-02', 200, { name: 'Başka ad' })
    const { state, report } = mergeState(st({ workouts: [mine] }), st({ workouts: [copy] }))
    expect(state.workouts).toEqual([mine])
    expect(report.workouts).toEqual({ added: 0, identical: 1, conflicting: 0 })
    expect(report.contentDuplicates).toBe(1)
  })

  it('aynı gün ve başlangıç ama farklı setler: ayrı antrenman olarak eklenir', () => {
    const other = wk('x', '2026-01-02', 200, { entries: [{ exId: 'bench', sets: [{ w: 70, r: 5, done: true }] }] })
    const { state, report } = mergeState(st({ workouts: [wk('a', '2026-01-02', 200)] }), st({ workouts: [other] }))
    expect(state.workouts).toHaveLength(2)
    expect(report.workouts.added).toBe(1)
    expect(report.contentDuplicates).toBe(0)
  })

  it('CSV iki cihazda ayrı içe aktarıldıysa özel egzersiz kimlikleri farklı olsa da kopya bulunur', () => {
    const entries = (id: string) => [{ exId: id, sets: [{ w: 10, r: 10, done: true }] }]
    const local = st({
      customEx: [custom('custom-L', 'Cable Fly')],
      workouts: [wk('a', '2026-01-02', 200, { entries: entries('custom-L') })],
    })
    const incoming = st({
      customEx: [custom('custom-R', ' cable fly ')],
      workouts: [wk('b', '2026-01-02', 200, { entries: entries('custom-R') })],
    })
    const { state, report } = mergeState(local, incoming)
    expect(state.workouts.map((w) => w.id)).toEqual(['a'])
    expect(report.contentDuplicates).toBe(1)
  })

  it('aynı dosyayı iki kez birleştirmek ikincide hiçbir şey değiştirmez', () => {
    const local = st({
      workouts: [wk('a', '2026-01-02', 200)],
      routines: [routine('r1', 'Push')],
      bodyweight: [{ d: '2026-01-01', w: 80 }],
    })
    const incoming = st({
      workouts: [wk('b', '2026-01-03', 300), wk('c', '2026-01-04', 400)],
      routines: [routine('r2', 'Pull')],
      bodyweight: [{ d: '2026-01-02', w: 81 }],
      customEx: [custom('custom-1', 'X')],
      muscleFix: { bench: { primary: ['chest'], secondary: [] } },
    })
    const once = mergeState(local, incoming)
    expect(totalAdded(once.report)).toBeGreaterThan(0)
    const twice = mergeState(once.state, incoming)
    expect(totalAdded(twice.report)).toBe(0)
    expect(twice.state).toEqual(once.state)
  })

  it('girdileri değiştirmez', () => {
    const local = st({ workouts: [wk('a', '2026-01-02', 200)] })
    const incoming = st({ workouts: [wk('b', '2026-01-01', 100)] })
    const l = JSON.stringify(local)
    const i = JSON.stringify(incoming)
    mergeState(local, incoming)
    expect(JSON.stringify(local)).toBe(l)
    expect(JSON.stringify(incoming)).toBe(i)
  })
})

describe('mergeState: diğer veriler', () => {
  it('rutinler kimliğe göre; çakışmada yerel kazanır, yeni olan eklenir', () => {
    const local = st({ routines: [routine('r1', 'Push', 20), routine('r2', 'Pull')] })
    const incoming = st({ routines: [routine('r1', 'Push', 99), routine('r2', 'Pull'), routine('r3', 'Legs')] })
    const { state, report } = mergeState(local, incoming)
    expect(state.routines.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    expect(state.routines[0].ex[0].weight).toBe(20)
    expect(report.routines).toEqual({ added: 1, identical: 1, conflicting: 1 })
  })

  it('aynı adlı farklı kimlikli rutin "(2)" ekiyle gelir (mergeRoutines kuralı)', () => {
    const { state } = mergeState(st({ routines: [routine('r1', 'Push')] }), st({ routines: [routine('r9', 'Push')] }))
    expect(state.routines.map((r) => r.name)).toEqual(['Push', 'Push (2)'])
  })

  it('kilo güne göre: aynı günde yerel kalır, sonuç tarihe göre sıralı', () => {
    const local = st({
      bodyweight: [
        { d: '2026-01-01', w: 82 },
        { d: '2026-01-05', w: 80 },
      ],
    })
    const incoming = st({
      bodyweight: [
        { d: '2026-01-05', w: 70 },
        { d: '2026-01-03', w: 81 },
        { d: '2026-01-01', w: 82 },
      ],
    })
    const { state, report } = mergeState(local, incoming)
    expect(state.bodyweight).toEqual([
      { d: '2026-01-01', w: 82 },
      { d: '2026-01-03', w: 81 },
      { d: '2026-01-05', w: 80 },
    ])
    expect(report.bodyweight).toEqual({ added: 1, identical: 1, conflicting: 1 })
  })

  it('özel egzersiz kimliğe göre, yerel kazanır', () => {
    const local = st({ customEx: [custom('c1', 'Yerel ad')] })
    const incoming = st({ customEx: [custom('c1', 'Uzak ad'), custom('c2', 'Yeni')] })
    const { state, report } = mergeState(local, incoming)
    expect(state.customEx.map((c) => [c.id, c.name])).toEqual([
      ['c1', 'Yerel ad'],
      ['c2', 'Yeni'],
    ])
    expect(report.customEx).toEqual({ added: 1, identical: 0, conflicting: 1 })
  })

  it('kas düzeltmesi yalnız yerelde olmayan egzersizler için gelir', () => {
    const local = st({
      muscleFix: { bench: { primary: ['chest'], secondary: [] }, row: { primary: ['lats'], secondary: [] } },
    })
    const incoming = st({
      muscleFix: {
        bench: { primary: ['triceps'], secondary: [] },
        row: { primary: ['lats'], secondary: [] },
        squat: { primary: ['quads'], secondary: [] },
      },
    })
    const { state, report } = mergeState(local, incoming)
    expect(state.muscleFix.bench.primary).toEqual(['chest'])
    expect(state.muscleFix.squat.primary).toEqual(['quads'])
    expect(report.muscleFix).toEqual({ added: 1, identical: 1, conflicting: 1 })
  })

  it('__proto__ anahtarlı kas düzeltmesi prototipi bozmaz', () => {
    const incoming = st({ muscleFix: JSON.parse('{"__proto__":{"primary":["chest"],"secondary":[]}}') })
    const { state } = mergeState(st(), incoming)
    expect(Object.getPrototypeOf(state.muscleFix)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).primary).toBeUndefined()
  })

  it('ayarlar, hafta ve aktif antrenman yerelde aynen kalır', () => {
    const active = wk('act', '2026-01-09', 900)
    const local = st({ settings: { ...defaultState().settings, unit: 'kg', restSec: 120 }, week: { 1: 'r1' }, active })
    const incoming = st({
      settings: { ...defaultState().settings, unit: 'lb', restSec: 30 },
      week: { 2: 'r2' },
      active: wk('other', '2026-01-10', 1000),
      workouts: [wk('b', '2026-01-03', 300)],
    })
    const { state } = mergeState(local, incoming)
    expect(state.settings).toBe(local.settings)
    expect(state.week).toBe(local.week)
    expect(state.active).toBe(active)
    expect(state.version).toBe(local.version)
  })

  it('boş yedek hiçbir şey eklemez', () => {
    const local = st({ workouts: [wk('a', '2026-01-02', 200)] })
    const { state, report } = mergeState(local, st())
    expect(state).toEqual(local)
    expect(totalAdded(report)).toBe(0)
  })
})
