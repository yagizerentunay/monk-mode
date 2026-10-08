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

  it('ısınma seti çalışma ağırlığından hesaplanır ve ısınma bloğunun sonuna girer', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100 }] })
    s.startWorkout('r1')
    useStore.getState().addWarmup(0)
    useStore.getState().addWarmup(0)
    const sets = useStore.getState().active!.entries[0].sets
    expect(sets.map((x) => [x.warmup ?? false, x.w])).toEqual([[true, 40], [true, 60], [false, 100], [false, 100]])
  })

  it('ısınma sayısını sınırlar', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100 }] })
    s.startWorkout('r1')
    for (let i = 0; i < 8; i++) useStore.getState().addWarmup(0)
    expect(useStore.getState().active!.entries[0].sets.filter((x) => x.warmup)).toHaveLength(4)
  })

  it('dropset ilgili setin hemen ardına girer ve zincirlenir', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100 }] })
    s.startWorkout('r1')
    useStore.getState().addDrop(0, 0)
    useStore.getState().addDrop(0, 0)
    const sets = useStore.getState().active!.entries[0].sets
    expect(sets.map((x) => [x.drop ?? false, x.w])).toEqual([[false, 100], [true, 80], [true, 65], [false, 100]])
  })

  it('dropset zincirini 3 ile sınırlar ve ısınmaya drop eklemez', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100, warmups: 1 }] })
    s.startWorkout('r1')
    useStore.getState().addDrop(0, 0) // ısınma seti: yok sayılır
    expect(useStore.getState().active!.entries[0].sets.some((x) => x.drop)).toBe(false)
    for (let i = 0; i < 6; i++) useStore.getState().addDrop(0, 1)
    expect(useStore.getState().active!.entries[0].sets.filter((x) => x.drop)).toHaveLength(3)
  })

  it('yeni set son dropun değil son çalışma setinin ağırlığını alır', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100, drops: 1 }] })
    s.startWorkout('r1')
    useStore.getState().addSet(0)
    const sets = useStore.getState().active!.entries[0].sets
    expect(sets[sets.length - 1]).toMatchObject({ w: 100, done: false })
    expect(sets[sets.length - 1].drop).toBeUndefined()
  })

  it('yalnız ısınması yapılmış egzersiz kayda girmez; tamamlanmamış ısınma kaydedilmez', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...routine, ex: [{ ...routine.ex[0], weight: 100, warmups: 2 }] })
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true })
    expect(useStore.getState().finishWorkout()).toBeNull()

    useStore.getState().startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true })
    useStore.getState().updateSet(0, 2, { done: true }) // ilk çalışma seti
    const finished = useStore.getState().finishWorkout()
    expect(finished?.entries[0].sets.map((x) => !!x.warmup)).toEqual([true, false])
  })

  it('snapshot eylemleri içermez', () => {
    expect(Object.keys(snapshot(useStore.getState())).sort()).toEqual(Object.keys(defaultState()).sort())
  })
})

describe('süperset', () => {
  const two = {
    ...routine,
    ex: [routine.ex[0], { ...routine.ex[0], exId: 'row' }],
  }

  it('seansta ikinci egzersizi öncekiyle bağlar ve çözer', () => {
    const s = useStore.getState()
    s.saveRoutine(two)
    s.startWorkout('r1')
    useStore.getState().toggleSuperset(1)
    expect(useStore.getState().active!.entries[1].linked).toBe(true)
    useStore.getState().toggleSuperset(1)
    expect(useStore.getState().active!.entries[1].linked).toBe(false)
  })

  it('ilk egzersizi bağlamaz', () => {
    const s = useStore.getState()
    s.saveRoutine(two)
    s.startWorkout('r1')
    useStore.getState().toggleSuperset(0)
    expect(useStore.getState().active!.entries[0].linked).toBeUndefined()
  })

  it('bağ, kaydedilen antrenmanda korunur', () => {
    const s = useStore.getState()
    s.saveRoutine({ ...two, ex: [two.ex[0], { ...two.ex[1], superset: true }] })
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true })
    useStore.getState().updateSet(1, 0, { done: true })
    const finished = useStore.getState().finishWorkout()
    expect(finished?.entries.map((e) => !!e.linked)).toEqual([false, true])
  })
})

describe('içe aktarma', () => {
  const wk = (id: string, d: string, start: number) => ({
    id,
    d,
    start,
    name: 'Üst',
    entries: [{ exId: 'bench', sets: [{ w: 60, r: 5, done: true }] }],
  })

  it('antrenmanları tarih sırasıyla birleştirir ve özel egzersizi ekler', () => {
    const s = useStore.getState()
    s.importWorkouts([wk('b', '2026-10-05', 5)], [])
    useStore.getState().importWorkouts(
      [wk('a', '2026-10-01', 1), wk('c', '2026-10-09', 9)],
      [{ id: 'custom-x', name: 'X', primaryMuscles: [], equipment: '' }],
    )
    expect(useStore.getState().workouts.map((w) => w.id)).toEqual(['a', 'b', 'c'])
    expect(useStore.getState().customEx.map((c) => c.id)).toEqual(['custom-x'])
  })

  it('aynı başlangıç ve adlı antrenmanı ikinci kez eklemez', () => {
    const s = useStore.getState()
    s.importWorkouts([wk('a', '2026-10-01', 1)], [])
    useStore.getState().importWorkouts([wk('a2', '2026-10-01', 1)], [])
    expect(useStore.getState().workouts).toHaveLength(1)
  })

  it('aynı kimlikli özel egzersizi çoğaltmaz', () => {
    const custom = { id: 'custom-x', name: 'X', primaryMuscles: [], equipment: '' }
    useStore.getState().importWorkouts([], [custom])
    useStore.getState().importWorkouts([], [custom])
    expect(useStore.getState().customEx).toHaveLength(1)
  })
})
