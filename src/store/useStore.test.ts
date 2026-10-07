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

  it('snapshot eylemleri içermez', () => {
    expect(Object.keys(snapshot(useStore.getState())).sort()).toEqual(Object.keys(defaultState()).sort())
  })
})
