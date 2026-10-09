import { beforeEach, describe, expect, it } from 'vitest'
import { dayString } from '../lib/workout.ts'
import { exportBackup, importBackup } from './backup.ts'
import { migrate } from './migrate.ts'
import { defaultState, type Routine, type State, type Workout } from './schema.ts'
import { useStore } from './useStore.ts'

const pull: Routine = {
  id: 'r1',
  name: 'Pull',
  ex: [
    { exId: 'pullup', sets: 2, reps: 5, weight: 0, prog: 'linear', inc: 2.5, repsMax: 8, bw: true },
    { exId: 'row', sets: 2, reps: 8, weight: 40, prog: 'linear', inc: 2.5, repsMax: 8 },
  ],
}

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('store: vücut ağırlığı egzersizi', () => {
  it('seansı kurarken günlükteki vücut ağırlığını bw egzersizine kopyalar', () => {
    const s = useStore.getState()
    s.saveRoutine(pull)
    s.logBodyweight({ d: '2000-01-01', w: 70 })
    s.logBodyweight({ d: '2000-02-01', w: 67 })
    s.startWorkout('r1')
    const [bw, plain] = useStore.getState().active!.entries
    expect(bw).toMatchObject({ bw: true, bwKg: 67 })
    expect(plain).not.toHaveProperty('bw')
  })

  it('bugünden sonraki kaydı kullanmaz; kayıt yoksa bwKg tanımsız', () => {
    const s = useStore.getState()
    s.saveRoutine(pull)
    s.logBodyweight({ d: '2999-01-01', w: 50 })
    s.startWorkout('r1')
    expect(useStore.getState().active!.entries[0]).not.toHaveProperty('bwKg')
  })

  it('bitirilen kayıtta bw ve bwKg korunur; sonradan kilo değişse de geçmiş kaymaz', () => {
    const s = useStore.getState()
    s.saveRoutine(pull)
    s.logBodyweight({ d: '2000-01-01', w: 67 })
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { w: 10, done: true })
    useStore.getState().finishWorkout()
    useStore.getState().logBodyweight({ d: dayString(), w: 80 })
    expect(useStore.getState().workouts[0].entries[0]).toMatchObject({ bw: true, bwKg: 67 })
  })

  it('antrenmana eklenen egzersiz cfg.bw ile bw gelir', () => {
    const s = useStore.getState()
    s.saveRoutine(pull)
    s.logBodyweight({ d: '2000-01-01', w: 67 })
    s.startWorkout('r1')
    useStore.getState().addExerciseToActive('dips', { bw: true })
    useStore.getState().addExerciseToActive('curl')
    const entries = useStore.getState().active!.entries
    expect(entries[2]).toMatchObject({ exId: 'dips', bw: true, bwKg: 67 })
    expect(entries[3]).not.toHaveProperty('bw')
  })

  it('değiştirirken bayrak değişiyorsa taşınan ağırlık 0\'lanır', () => {
    const s = useStore.getState()
    s.saveRoutine(pull)
    s.logBodyweight({ d: '2000-01-01', w: 67 })
    s.startWorkout('r1')
    // Dumbbell row (40 kg mutlak) → ters barfiks (bw): 40 kg ek yük olmamalı.
    useStore.getState().swapExercise(1, 'chinup', false, true)
    const e = useStore.getState().active!.entries[1]
    expect(e).toMatchObject({ exId: 'chinup', bw: true, bwKg: 67 })
    expect(e.sets.every((x) => x.w === 0)).toBe(true)
  })

  it('bw → mutlak değişimde bw bayrakları temizlenir ve ağırlık 0\'lanır', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...pull, ex: [{ ...pull.ex[0], weight: 10 }] })
    s.logBodyweight({ d: '2000-01-01', w: 67 })
    s.startWorkout('r1')
    useStore.getState().swapExercise(0, 'lat-pulldown', false, false)
    const e = useStore.getState().active!.entries[0]
    expect(e.exId).toBe('lat-pulldown')
    expect(e).not.toHaveProperty('bw')
    expect(e).not.toHaveProperty('bwKg')
    expect(e.sets.every((x) => x.w === 0)).toBe(true)
  })

  it('bayrak değişmiyorsa ağırlık (ek yük) taşınır; eski mutlak geçmiş yok sayılır', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...pull, ex: [{ ...pull.ex[0], weight: 10 }] })
    // dips için eski, mutlak yükle girilmiş kayıt: ön dolduruyu etkilememeli.
    const old: Workout = {
      id: 'o',
      d: '1999-01-01',
      start: 1,
      name: 'x',
      entries: [{ exId: 'dips', sets: [{ w: 67, r: 8, done: true }] }],
    }
    useStore.getState().importWorkouts([old], [])
    s.startWorkout('r1')
    useStore.getState().swapExercise(0, 'dips', false, true)
    const e = useStore.getState().active!.entries[0]
    expect(e.bw).toBe(true)
    expect(e.sets.every((x) => x.w === 10)).toBe(true)
  })
})

describe('migrate ve yedek: bw alanları', () => {
  const state = (): State => {
    const s = defaultState()
    s.routines = [pull]
    s.workouts = [
      {
        id: 'w1',
        d: '2026-10-01',
        start: 1,
        name: 'Pull',
        entries: [
          { exId: 'pullup', bw: true, bwKg: 67.5, sets: [{ w: -10, r: 6, done: true }] },
          { exId: 'row', sets: [{ w: 40, r: 8, done: true }] },
        ],
      },
    ]
    s.active = {
      id: 'a',
      d: '2026-10-08',
      start: 2,
      name: 'Pull',
      entries: [{ exId: 'pullup', bw: true, bwKg: 66, sets: [{ w: 0, r: 5, done: false }] }],
    }
    return s
  }

  it('migrate rutindeki bw, kayıttaki bw/bwKg ve negatif ek yükü kaybetmez', () => {
    const out = migrate(JSON.parse(JSON.stringify(state())))
    expect(out.routines[0].ex[0].bw).toBe(true)
    expect(out.workouts[0].entries[0]).toMatchObject({ bw: true, bwKg: 67.5 })
    expect(out.workouts[0].entries[0].sets[0].w).toBe(-10)
    expect(out.workouts[0].entries[1]).not.toHaveProperty('bw')
    expect(out.active?.entries[0]).toMatchObject({ bw: true, bwKg: 66 })
  })

  it('bw alanı olmayan eski veri aynen geçer (bw eklenmez)', () => {
    const old = defaultState()
    old.workouts = [{ id: 'w', d: '2026-01-01', start: 1, name: 'x', entries: [{ exId: 'pullup', sets: [{ w: 67, r: 8, done: true }] }] }]
    const out = migrate(JSON.parse(JSON.stringify(old)))
    expect(out.workouts[0].entries[0]).toEqual(old.workouts[0].entries[0])
  })

  it('yedek dışa/içe aktarma bw alanlarını korur', () => {
    const s = state()
    expect(importBackup(exportBackup(s)).workouts).toEqual(s.workouts)
    expect(importBackup(exportBackup(s)).routines).toEqual(s.routines)
  })
})
