import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRest, REST_KEY, saveRest } from '../lib/restState.ts'
import { listSnapshots } from './snapshots.ts'
import { defaultState, type Routine, type Workout } from './schema.ts'
import { useToast } from './toast.ts'
import { deleteRoutineWithUndo, deleteWorkoutWithUndo, discardActiveWithUndo } from './undoDelete.ts'
import { snapshot, useStore } from './useStore.ts'

const routine = (id: string): Routine => ({
  id,
  name: `Rutin ${id}`,
  ex: [{ exId: 'bench', sets: 2, reps: 5, weight: 60, prog: 'linear', inc: 2.5, repsMax: 8 }],
})

const workout = (id: string, d: string, start: number): Workout => ({ id, d, start, end: start + 1000, name: id, entries: [] })

function undo(): void {
  const t = useToast.getState().toast
  expect(t?.undo).toBeTypeOf('function')
  t?.undo?.()
}

/** Testler Node ortamında koşar; dinlenme sayacı için bellek içi bir localStorage takılır. */
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

beforeEach(() => {
  indexedDB.deleteDatabase('monk-mode')
  vi.stubGlobal('localStorage', memoryStorage())
  useStore.getState().replaceAll(defaultState())
  useToast.getState().dismiss()
})

describe('silmeyi geri al', () => {
  it('geçmiş antrenmanı silip geri alınca aynı sıraya koyar', () => {
    const list = [workout('a', '2026-10-01', 100), workout('b', '2026-10-03', 100), workout('c', '2026-10-05', 100)]
    useStore.getState().replaceAll({ ...defaultState(), workouts: list })
    const before = snapshot(useStore.getState())

    deleteWorkoutWithUndo('b')
    expect(useStore.getState().workouts.map((w) => w.id)).toEqual(['a', 'c'])
    expect(useToast.getState().toast?.text).toBe('Antrenman silindi')

    undo()
    expect(snapshot(useStore.getState())).toEqual(before)
    expect(useStore.getState().workouts.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('olmayan antrenmanda bildirim göstermez', () => {
    deleteWorkoutWithUndo('yok')
    expect(useToast.getState().toast).toBeNull()
  })

  it('rutini silip geri alınca sırasını ve hafta günlerini döndürür', () => {
    useStore.getState().replaceAll({
      ...defaultState(),
      routines: [routine('r1'), routine('r2'), routine('r3')],
      week: { 1: 'r2', 3: 'r1', 5: 'r2' },
    })
    const before = snapshot(useStore.getState())

    deleteRoutineWithUndo('r2')
    expect(useStore.getState().routines.map((r) => r.id)).toEqual(['r1', 'r3'])
    expect(useStore.getState().week).toEqual({ 3: 'r1' })
    expect(useToast.getState().toast?.text).toBe('Rutin silindi')

    undo()
    expect(snapshot(useStore.getState())).toEqual(before)
  })

  it('geri alırken o arada başka rutine atanan güne dokunmaz', () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1'), routine('r2')], week: { 1: 'r2', 2: 'r2' } })
    deleteRoutineWithUndo('r2')
    useStore.getState().assignDay(1, 'r1')
    undo()
    expect(useStore.getState().week).toEqual({ 1: 'r1', 2: 'r2' })
  })

  it('devam eden antrenmanı atıp geri alınca aynen aktif yapar', () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1')] })
    useStore.getState().startWorkout('r1')
    useStore.getState().updateSet(0, 0, { done: true, r: 5 })
    const before = snapshot(useStore.getState())

    discardActiveWithUndo()
    expect(useStore.getState().active).toBeNull()
    expect(useToast.getState().toast?.text).toBe('Devam eden antrenman silindi')

    undo()
    expect(snapshot(useStore.getState())).toEqual(before)
  })

  it('atılan antrenmanın dinlenme sayacını geri getirir; dolmuşsa getirmez', () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1')] })
    useStore.getState().startWorkout('r1')
    const id = useStore.getState().active!.id

    saveRest(id, null)
    discardActiveWithUndo(Date.now() + 60_000)
    expect(loadRest(id, Date.now())).toBeNull()
    undo()
    expect(loadRest(id, Date.now())).not.toBeNull()

    localStorage.removeItem(REST_KEY)
    useStore.getState().discardWorkout()
    useStore.getState().restoreActive({ ...useStore.getState().active!, id })
    discardActiveWithUndo(Date.now() - 1)
    undo()
    expect(loadRest(id, 0)).toBeNull()
  })

  it('geri alırken başka bir antrenman başladıysa onu ezmez', () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1')] })
    useStore.getState().startWorkout('r1')
    const old = useStore.getState().active!
    discardActiveWithUndo()
    useStore.getState().startWorkout('r1')
    const fresh = useStore.getState().active!
    expect(fresh.id).not.toBe(old.id)
    undo()
    expect(useStore.getState().active?.id).toBe(fresh.id)
  })

  it('yeni silme eski bildirimin yerini alır', () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1')], workouts: [workout('a', '2026-10-01', 1)] })
    deleteWorkoutWithUndo('a')
    const first = useToast.getState().toast!
    deleteRoutineWithUndo('r1')
    const second = useToast.getState().toast!
    expect(second.id).toBeGreaterThan(first.id)
    expect(second.text).toBe('Rutin silindi')
  })

  it('silmeden önce, silinen öğeyi hâlâ içeren otomatik kopya alır', async () => {
    useStore.getState().replaceAll({ ...defaultState(), routines: [routine('r1')], workouts: [workout('a', '2026-10-01', 1)] })
    deleteWorkoutWithUndo('a')
    await vi.waitFor(async () => {
      expect((await listSnapshots()).map((x) => [x.reason, x.workouts])).toEqual([['Antrenman silinmeden önce', 1]])
    })
    deleteRoutineWithUndo('r1')
    await vi.waitFor(async () => {
      expect((await listSnapshots())[0]).toMatchObject({ reason: 'Rutin silinmeden önce', workouts: 0 })
    })
  })
})

