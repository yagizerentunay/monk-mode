import { beforeEach, describe, expect, it } from 'vitest'
import { applyRirToEntry, missingRirCount } from '../lib/rir.ts'
import { defaultState } from './schema.ts'
import { useStore } from './useStore.ts'

const routine = {
  id: 'r1',
  name: 'Push',
  ex: [
    { exId: 'bench', sets: 2, reps: 5, weight: 60, prog: 'linear' as const, inc: 2.5, repsMax: 8 },
    { exId: 'row', sets: 1, reps: 8, weight: 50, prog: 'linear' as const, inc: 2.5, repsMax: 8 },
  ],
}

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('antrenman sonu RIR doldurma akışı', () => {
  it('bitmiş antrenmanda RIR hiç kendiliğinden gelmez; toplu uygulama kaydı yerinde günceller', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true, r: 5 })
    useStore.getState().updateSet(0, 1, { done: true, r: 5 })
    useStore.getState().updateSet(1, 0, { done: true, r: 8, rir: 1 })
    const finished = useStore.getState().finishWorkout()!
    expect(missingRirCount(finished)).toBe(2) // kullanıcı dokunmadıkça RIR yazılmaz

    const next = applyRirToEntry(finished, 0, 2)
    useStore.getState().updateWorkout(next)

    const { workouts } = useStore.getState()
    expect(workouts).toHaveLength(1)
    expect(workouts[0]).toMatchObject({ id: finished.id, d: finished.d, start: finished.start, name: 'Push' })
    expect(workouts[0].entries.map((e) => e.exId)).toEqual(['bench', 'row'])
    expect(workouts[0].entries[0].sets.map((x) => x.rir)).toEqual([2, 2])
    expect(workouts[0].entries[1].sets[0].rir).toBe(1) // dolu olana dokunulmadı
    expect(missingRirCount(workouts[0])).toBe(0)
  })

  it('atlanırsa kayıtlı antrenman RIR\'siz kalır', () => {
    const s = useStore.getState()
    s.saveRoutine(routine)
    s.startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true, r: 5 })
    const finished = useStore.getState().finishWorkout()!
    expect(useStore.getState().workouts[0]).toEqual(finished)
    expect(useStore.getState().workouts[0].entries[0].sets[0].rir).toBeUndefined()
  })
})
