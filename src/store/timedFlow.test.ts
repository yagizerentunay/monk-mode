import { beforeEach, describe, expect, it } from 'vitest'
import { isPR } from '../lib/workout.ts'
import { defaultState } from './schema.ts'
import { useStore } from './useStore.ts'

const routine = {
  id: 'r1',
  name: 'Core',
  ex: [{ exId: 'plank', sets: 2, reps: 30, weight: 0, prog: 'double' as const, inc: 0, repsMax: 30, timed: true, warmups: 2 }],
}

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

/** Plank'i bitmiş bir seans olarak kaydeder: iki set 40 sn. */
function recordPlank() {
  const s = useStore.getState()
  s.saveRoutine(routine)
  s.startWorkout('r1')
  useStore.getState().updateSet(0, 0, { done: true, r: 40 })
  useStore.getState().updateSet(0, 1, { done: true, r: 45 })
  return useStore.getState().finishWorkout()!
}

describe('süreli seans akışı', () => {
  it('rutinden süreli girdi kurar, kaydeder ve yedeğe tam gidiş-dönüş yapar', () => {
    const finished = recordPlank()
    expect(finished.entries[0].timed).toBe(true)
    expect(finished.entries[0].sets.map((x) => x.r)).toEqual([40, 45])
    expect(useStore.getState().workouts[0]).toEqual(finished)
  })

  it('aynı rutinin sonraki seansı süreyi 5 sn artırır', () => {
    recordPlank()
    useStore.getState().startWorkout('r1')
    expect(useStore.getState().active!.entries[0].sets.map((x) => x.r)).toEqual([45, 45])
  })

  it('rekor ölçüsü en uzun tutuştur', () => {
    const finished = recordPlank()
    expect(isPR([], finished.entries[0])).toBe(true)
    expect(isPR([finished], { ...finished.entries[0], sets: [{ w: 0, r: 46, done: true }] })).toBe(true)
    expect(isPR([finished], { ...finished.entries[0], sets: [{ w: 0, r: 45, done: true }] })).toBe(false)
  })

  it('serbest antrenmanda son seansı süreliyse egzersiz süreli gelir', () => {
    recordPlank()
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('plank')
    const entry = useStore.getState().active!.entries[0]
    expect(entry.timed).toBe(true)
    expect(entry.sets.map((x) => x.r)).toEqual([40, 40])
  })

  it('geçmişi olmayan egzersiz tekrarlı başlar; açıkça timed verilirse 30 sn gelir', () => {
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('crunch')
    useStore.getState().addExerciseToActive('hold', { timed: true })
    const [crunch, hold] = useStore.getState().active!.entries
    expect(crunch.timed).toBeUndefined()
    expect(crunch.sets[0].r).toBe(8)
    expect(hold.timed).toBe(true)
    expect(hold.sets.map((x) => x.r)).toEqual([30, 30, 30])
  })

  it('tek taraflı süreli egzersiz iki tarafa saniye hedefini taşır', () => {
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('side-plank', { timed: true, side: true })
    const entry = useStore.getState().active!.entries[0]
    expect(entry.unilateral).toBe(true)
    expect(entry.sets[0].sides).toEqual({ L: { r: 30, done: false }, R: { r: 30, done: false } })
  })

  it('değiştirirken yeni egzersiz son seansına göre süreli olur', () => {
    recordPlank()
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('crunch')
    useStore.getState().swapExercise(0, 'plank')
    const entry = useStore.getState().active!.entries[0]
    expect(entry).toMatchObject({ exId: 'plank', timed: true })
    // Eski egzersizin 3 seti vardı, plank geçmişinde 2 set yapılmıştı: set sayısı tutmadığı için en kısa tutuş (40) tekrarlanır.
    expect(entry.sets.map((x) => x.r)).toEqual([40, 40, 40])
  })

  it('"Süreli" düğmesi tekrarlı egzersizi çevirir, set tamamlanınca devre dışı kalır', () => {
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('crunch')
    useStore.getState().toggleTimed(0)
    expect(useStore.getState().active!.entries[0]).toMatchObject({ timed: true })
    expect(useStore.getState().active!.entries[0].sets.map((x) => x.r)).toEqual([30, 30, 30])
    useStore.getState().toggleTimed(0)
    expect(useStore.getState().active!.entries[0].timed).toBeUndefined()
    expect(useStore.getState().active!.entries[0].sets[0].r).toBe(8)
    useStore.getState().updateSet(0, 0, { done: true })
    useStore.getState().toggleTimed(0)
    expect(useStore.getState().active!.entries[0].timed).toBeUndefined()
  })

  it('süreli egzersize ısınma eklenmez', () => {
    useStore.getState().startFreeWorkout()
    useStore.getState().addExerciseToActive('hold', { timed: true })
    useStore.getState().addWarmup(0)
    expect(useStore.getState().active!.entries[0].sets.some((x) => x.warmup)).toBe(false)
  })

  it('yeni set süreli hedefi kopyalar', () => {
    useStore.getState().startFreeWorkout()
    useStore.getState().addExerciseToActive('hold', { timed: true, sets: 1, reps: 50 })
    useStore.getState().addSet(0)
    expect(useStore.getState().active!.entries[0].sets.map((x) => x.r)).toEqual([50, 50])
  })
})
