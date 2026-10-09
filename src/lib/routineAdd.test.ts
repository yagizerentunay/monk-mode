import { describe, expect, it } from 'vitest'
import type { Routine } from '../store/schema.ts'
import { addToRoutine, defaultExCfg, routineHas } from './routineAdd.ts'

const ex = (over: Partial<{ id: string; name: string; equipment: string | null }> = {}) => ({
  id: 'bench',
  name: 'Barbell Bench Press',
  equipment: 'barbell' as string | null,
  ...over,
})

const routine = (): Routine => ({
  id: 'r1',
  name: 'Push',
  ex: [{ exId: 'dip', sets: 4, reps: 6, weight: 10, prog: 'linear', inc: 2.5, repsMax: 8 }],
})

describe('defaultExCfg', () => {
  it('rutin düzenleyicideki yeni egzersiz varsayılanıdır', () => {
    expect(defaultExCfg(ex())).toEqual({
      exId: 'bench',
      sets: 3,
      reps: 8,
      weight: 0,
      prog: 'double',
      inc: 2.5,
      repsMax: 12,
      side: false,
    })
  })

  it('tek taraflılığı adından, vücut ağırlığını ekipmandan önerir', () => {
    expect(defaultExCfg(ex({ name: 'Bulgarian Split Squat' })).side).toBe(true)
    expect(defaultExCfg(ex({ equipment: 'body only' })).bw).toBe(true)
    expect('bw' in defaultExCfg(ex({ equipment: null }))).toBe(false)
  })
})

describe('addToRoutine', () => {
  it('egzersizi sona ekler, sıra ve diğer alanlar korunur', () => {
    const out = addToRoutine(routine(), ex())!
    expect(out.ex.map((c) => c.exId)).toEqual(['dip', 'bench'])
    expect(out.id).toBe('r1')
    expect(out.name).toBe('Push')
    expect(out.ex[0]).toEqual(routine().ex[0])
    expect(out.ex[1]).toEqual(defaultExCfg(ex()))
  })

  it('girdi rutini mutasyona uğratmaz', () => {
    const before = routine()
    const snapshot = structuredClone(before)
    const out = addToRoutine(before, ex())!
    expect(before).toEqual(snapshot)
    expect(out).not.toBe(before)
    expect(out.ex).not.toBe(before.ex)
  })

  it('egzersiz zaten rutinde ise null döner', () => {
    expect(addToRoutine(routine(), ex({ id: 'dip' }))).toBeNull()
    expect(routineHas(routine(), 'dip')).toBe(true)
    expect(routineHas(routine(), 'bench')).toBe(false)
  })

  it('boş rutine eklenebilir', () => {
    const out = addToRoutine({ id: 'r', name: 'Boş', ex: [] }, ex())!
    expect(out.ex).toHaveLength(1)
  })
})
