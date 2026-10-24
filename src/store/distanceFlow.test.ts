import { beforeEach, describe, expect, it } from 'vitest'
import { workoutVolume } from '../lib/workout.ts'
import { defaultState } from './schema.ts'
import { useStore } from './useStore.ts'

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('mesafe seansı akışı', () => {
  it('serbest seansa koşu ekler, mesafe/süre girer, kaydeder; sonraki seans oradan başlar', () => {
    const s = useStore.getState()
    s.startFreeWorkout()
    useStore.getState().addExerciseToActive('run', { distance: true })
    expect(useStore.getState().active!.entries[0]).toEqual({ exId: 'run', distance: true, sets: [{ w: 0, r: 1800, m: 5000, done: false }] })
    useStore.getState().updateSet(0, 0, { m: 6200, r: 1980, done: true })
    // Isınma, drop ve tek taraf mesafe setinde yok.
    useStore.getState().addWarmup(0)
    useStore.getState().addDrop(0, 0)
    useStore.getState().toggleUnilateral(0)
    useStore.getState().addSet(0)
    const e = useStore.getState().active!.entries[0]
    expect(e.unilateral).toBeUndefined()
    expect(e.sets).toEqual([
      { w: 0, r: 1980, m: 6200, done: true },
      { w: 0, r: 1980, m: 6200, done: false },
    ])
    const finished = useStore.getState().finishWorkout()!
    expect(finished.entries[0].sets).toEqual([{ w: 0, r: 1980, m: 6200, done: true }])
    expect(workoutVolume(finished)).toBe(0)

    // Bayrak verilmeden eklenince son seans mesafe olduğu için mesafe gelir.
    useStore.getState().startFreeWorkout()
    useStore.getState().addExerciseToActive('run')
    expect(useStore.getState().active!.entries[0]).toEqual({ exId: 'run', distance: true, sets: [{ w: 0, r: 1980, m: 6200, done: false }] })
  })

  it('"Mesafe" geçişi tekrarlı girdiyi çevirir; süreli geçişi mesafe girdisinde çalışmaz', () => {
    useStore.getState().startFreeWorkout()
    useStore.getState().addExerciseToActive('row')
    useStore.getState().toggleDistance(0)
    expect(useStore.getState().active!.entries[0].distance).toBe(true)
    useStore.getState().toggleTimed(0)
    expect(useStore.getState().active!.entries[0].timed).toBeUndefined()
    useStore.getState().toggleDistance(0)
    expect(useStore.getState().active!.entries[0].distance).toBeUndefined()
  })
})
