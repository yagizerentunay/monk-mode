import { describe, expect, it } from 'vitest'
import type { Routine, Workout } from '../store/schema.ts'
import { suggestNextRoutine } from './nextWorkout.ts'

const routine = (id: string): Routine => ({ id, name: `${id} Günü`, ex: [] })
const A = routine('a')
const B = routine('b')
const C = routine('c')

const wk = (d: string, routineId?: string): Workout => ({ id: `${d}-${routineId ?? 'x'}`, d, start: 0, end: 1, routineId, name: 't', entries: [] })

describe('sıradaki rutin önerisi', () => {
  it('rutin yoksa öneri yok', () => {
    expect(suggestNextRoutine([], [wk('2026-10-01', 'a')])).toBeUndefined()
  })

  it('hiç antrenman yoksa ilk rutini önerir', () => {
    expect(suggestNextRoutine([A, B], [])).toEqual({ routine: A })
  })

  it('A yapıldıysa B, B yapıldıysa C önerir', () => {
    expect(suggestNextRoutine([A, B, C], [wk('2026-10-01', 'a')])).toEqual({ routine: B, last: A })
    expect(suggestNextRoutine([A, B, C], [wk('2026-10-01', 'a'), wk('2026-10-02', 'b')])).toEqual({ routine: C, last: B })
  })

  it('sondan başa döner (B -> A)', () => {
    expect(suggestNextRoutine([A, B], [wk('2026-10-01', 'a'), wk('2026-10-02', 'b')])).toEqual({ routine: A, last: B })
  })

  it('tek rutin varsa yine onu önerir', () => {
    expect(suggestNextRoutine([A], [wk('2026-10-01', 'a')])).toEqual({ routine: A, last: A })
  })

  it('silinmiş rutine ait kayıt atlanır, bir önceki geçerli kayda bakılır', () => {
    const ws = [wk('2026-10-01', 'a'), wk('2026-10-02', 'silinmis')]
    expect(suggestNextRoutine([A, B], ws)).toEqual({ routine: B, last: A })
  })

  it('geçmişin hepsi silinmiş rutinlere aitse ilk rutini önerir', () => {
    expect(suggestNextRoutine([A, B], [wk('2026-10-01', 'silinmis')])).toEqual({ routine: A })
  })

  it('rutinsiz (serbest) antrenmanlar rotasyonu bozmaz', () => {
    const ws = [wk('2026-10-01', 'a'), wk('2026-10-02'), wk('2026-10-03')]
    expect(suggestNextRoutine([A, B], ws)).toEqual({ routine: B, last: A })
  })

  it('yalnız serbest antrenman varsa ilk rutini önerir', () => {
    expect(suggestNextRoutine([A, B], [wk('2026-10-03')])).toEqual({ routine: A })
  })

  it('sırayı rutin sırasından alır, son kayıt belirleyicidir', () => {
    const ws = [wk('2026-10-01', 'b'), wk('2026-10-02', 'a')]
    expect(suggestNextRoutine([A, B, C], ws)).toEqual({ routine: B, last: A })
  })
})
