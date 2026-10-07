import { beforeEach, describe, expect, it } from 'vitest'
import { defaultState } from './schema.ts'
import { snapshot, useStore } from './useStore.ts'

const routine = {
  id: 'r1',
  name: 'Push',
  ex: [{ exId: 'bench', sets: 2, reps: 5, weight: 60, prog: 'linear' as const, inc: 2.5, repsMax: 8 }],
}

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('store akışı', () => {
  it('rutin kaydedip güne atar, silinince atamayı kaldırır', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.assignDay(1, 'r1')
    expect(useStore.getState().week[1]).toBe('r1')
    useStore.getState().deleteRoutine('r1')
    expect(useStore.getState().week[1]).toBeUndefined()
    expect(useStore.getState().routines).toHaveLength(0)
  })

  it('seansı başlatır, set işaretler ve bitirince geçmişe yazar', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    expect(useStore.getState().active?.entries[0].sets).toHaveLength(2)
    useStore.getState().updateSet(0, 0, { done: true, r: 5 })
    const finished = useStore.getState().finishWorkout()
    expect(finished?.entries[0].sets).toHaveLength(1)
    expect(useStore.getState().active).toBeNull()
    expect(useStore.getState().workouts).toHaveLength(1)
  })

  it('hiç set tamamlanmadıysa kayıt oluşturmaz', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    expect(useStore.getState().finishWorkout()).toBeNull()
    expect(useStore.getState().workouts).toHaveLength(0)
  })

  it('aktif seans varken ikinci seans başlatmaz', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    const id = useStore.getState().active?.id
    useStore.getState().startWorkout('r1')
    expect(useStore.getState().active?.id).toBe(id)
  })

  it('aynı güne ikinci tartıyı eskinin yerine yazar', () => {
    const s = useStore.getState()
    s.logBodyweight({ d: '2026-10-08', w: 80 })
    useStore.getState().logBodyweight({ d: '2026-10-08', w: 79.5 })
    expect(useStore.getState().bodyweight).toEqual([{ d: '2026-10-08', w: 79.5 }])
  })

  it('tek taraflı setin tarafları ayrı işaretlenir; ikisi bitince set tamamlanır', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], side: true }] })
    s.startWorkout('r1')
    expect(useStore.getState().active?.entries[0].unilateral).toBe(true)

    useStore.getState().updateSide(0, 0, 'L', { done: true, r: 6 })
    let set0 = useStore.getState().active!.entries[0].sets[0]
    expect(set0.done).toBe(false)
    expect(set0.r).toBe(5) // R hâlâ hedef 5, zayıf taraf

    useStore.getState().updateSide(0, 0, 'R', { done: true, r: 4 })
    set0 = useStore.getState().active!.entries[0].sets[0]
    expect(set0.done).toBe(true)
    expect(set0.r).toBe(4)
    expect(set0.sides).toEqual({ L: { r: 6, done: true }, R: { r: 4, done: true } })
  })

  it('yalnız bir tarafı biten set kayda alınmaz', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], side: true }] })
    s.startWorkout('r1')
    useStore.getState().updateSide(0, 0, 'L', { done: true })
    expect(useStore.getState().finishWorkout()).toBeNull()
  })

  it('egzersizi tek taraflıya çevirip geri alır, durumu korur', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true, r: 7 })
    useStore.getState().toggleUnilateral(0)
    let e = useStore.getState().active!.entries[0]
    expect(e.unilateral).toBe(true)
    expect(e.sets[0].sides).toEqual({ L: { r: 7, done: true }, R: { r: 7, done: true } })

    useStore.getState().toggleUnilateral(0)
    e = useStore.getState().active!.entries[0]
    expect(e.unilateral).toBe(false)
    expect(e.sets[0].sides).toBeUndefined()
    expect(e.sets[0]).toMatchObject({ r: 7, done: true })
  })

  it('yeni set, son setin sol/sağ hedeflerini taşır ve tamamlanmamış başlar', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], side: true }] })
    s.startWorkout('r1')
    useStore.getState().updateSide(0, 1, 'L', { r: 9, done: true })
    useStore.getState().updateSide(0, 1, 'R', { r: 7, done: true })
    useStore.getState().addSet(0)
    const added = useStore.getState().active!.entries[0].sets[2]
    expect(added.sides).toEqual({ L: { r: 9, done: false }, R: { r: 7, done: false } })
    expect(added.done).toBe(false)
  })

  it('seansa sonradan eklenen egzersiz tek taraflı olabilir', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    useStore.getState().addExerciseToActive('lunge', { side: true, sets: 2, reps: 10 })
    const e = useStore.getState().active!.entries[1]
    expect(e.unilateral).toBe(true)
    expect(e.sets).toHaveLength(2)
    expect(e.sets[0].sides?.L.r).toBe(10)
  })

  it('snapshot eylemleri içermez', () => {
    expect(Object.keys(snapshot(useStore.getState())).sort()).toEqual(Object.keys(defaultState()).sort())
  })
})
