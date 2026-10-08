import { describe, expect, it } from 'vitest'
import type { CustomExercise, Routine } from '../store/schema.ts'
import { mergeRoutines, sanitizeRoutine } from './mergeRoutines.ts'

const ex = (exId: string, over: Record<string, unknown> = {}) => ({
  exId,
  sets: 3,
  reps: 8,
  weight: 20,
  prog: 'double',
  inc: 2.5,
  repsMax: 12,
  ...over,
})
const routine = (id: string, name: string, exs = [ex('bench')]): Routine => ({ id, name, ex: exs }) as Routine
const have = (routines: Routine[] = [], customEx: CustomExercise[] = []) => ({ routines, customEx })

describe('rutin doğrulama', () => {
  it('geçerli rutini aynen döner', () => {
    expect(sanitizeRoutine({ id: 'r', name: ' Üst ', ex: [ex('bench', { warmups: 1, superset: true })] })).toEqual({
      id: 'r',
      name: 'Üst',
      ex: [{ ...ex('bench'), warmups: 1, superset: true }],
    })
  })

  it('eksik sayıları varsayılanla tamamlar, sınırları kırpar', () => {
    const r = sanitizeRoutine({
      id: 'r',
      name: 'x',
      ex: [{ exId: 'a', warmups: 99, drops: -4, repsMax: 2, reps: 6, prog: 'weird', sets: 0 }],
    })
    expect(r?.ex[0]).toMatchObject({ sets: 3, reps: 6, weight: 0, prog: 'double', inc: 2.5, repsMax: 6, warmups: 4, drops: 0 })
  })

  it('bozuk rutini ve egzersizsiz rutini reddeder, bozuk egzersizi atar', () => {
    expect(sanitizeRoutine(null)).toBeNull()
    expect(sanitizeRoutine({ id: '', name: 'x', ex: [ex('a')] })).toBeNull()
    expect(sanitizeRoutine({ id: 'r', name: 'x', ex: 'nope' })).toBeNull()
    expect(sanitizeRoutine({ id: 'r', name: 'x', ex: [{ exId: 5 }] })).toBeNull()
    expect(sanitizeRoutine({ id: 'r', name: 'x', ex: [{ exId: 5 }, ex('ok')] })?.ex).toHaveLength(1)
  })

  it('boş adı varsayılan ad yapar', () => {
    expect(sanitizeRoutine({ id: 'r', name: '   ', ex: [ex('a')] })?.name).toBe('Rutin')
  })
})

describe('rutin ekleme', () => {
  it('mevcut rutinlerin üstüne ekler, mevcutlara dokunmaz', () => {
    const mine = routine('mine', 'Bacak')
    const m = mergeRoutines(have([mine]), { routines: [routine('new', 'A Günü')], customEx: [] })
    expect(m.routines.map((r) => r.id)).toEqual(['mine', 'new'])
    expect(m).toMatchObject({ added: 1, skipped: 0, invalid: 0 })
  })

  it('aynı kimlikli rutini atlar: dosyayı iki kez yüklemek çoğaltmaz', () => {
    const first = mergeRoutines(have(), { routines: [routine('r', 'A Günü')], customEx: [] })
    const second = mergeRoutines(have(first.routines), { routines: [routine('r', 'A Günü')], customEx: [] })
    expect(second.routines).toHaveLength(1)
    expect(second).toMatchObject({ added: 0, skipped: 1 })
  })

  it('aynı ada sahip farklı kimlikli rutine sayı ekler', () => {
    const m = mergeRoutines(have([routine('a', 'A Günü')]), {
      routines: [routine('b', 'a günü'), routine('c', 'A Günü')],
      customEx: [],
    })
    expect(m.routines.map((r) => r.name)).toEqual(['A Günü', 'a günü (2)', 'A Günü (3)'])
  })

  it('geçersiz rutinleri sayar ve atlar', () => {
    const m = mergeRoutines(have(), { routines: [{ nope: 1 }, routine('ok', 'Ok')], customEx: [] })
    expect(m).toMatchObject({ added: 1, invalid: 1 })
  })

  it('yalnız eklenen rutinlerin kullandığı özel egzersizleri alır', () => {
    const custom = (id: string) => ({ id, name: id, primaryMuscles: ['chest'], equipment: '' })
    const m = mergeRoutines(have([], [custom('old') as CustomExercise]), {
      routines: [routine('r', 'x', [ex('custom-1')])],
      customEx: [custom('custom-1'), custom('custom-unused'), custom('old')],
    })
    expect(m.customEx.map((c) => c.id)).toEqual(['old', 'custom-1'])
  })

  it('dosyada rutin alanı yoksa hiçbir şey eklemez', () => {
    const m = mergeRoutines(have(), { routines: undefined, customEx: undefined })
    expect(m).toMatchObject({ added: 0, skipped: 0, invalid: 0 })
  })

  it('girdiyi değiştirmez', () => {
    const mine = [routine('mine', 'Bacak')]
    mergeRoutines(have(mine), { routines: [routine('new', 'A')], customEx: [] })
    expect(mine).toHaveLength(1)
  })
})
