import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import {
  addSetTo,
  editSet,
  finalizeEdit,
  removeEntryAt,
  removeSetAt,
  setEntryNoteIn,
  setWorkoutNoteIn,
} from './editWorkout.ts'
import { deriveSet } from './sets.ts'

const set = (w: number, r: number, over: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...over })
const uni = (w: number, l: number, r: number): SetEntry =>
  deriveSet({ w, r: 0, done: true, sides: { L: { r: l, done: true }, R: { r, done: true } } })
const wk = (entries: Workout['entries']): Workout => ({ id: 'w', d: '2026-10-01', start: 1, name: 't', entries })

describe('set düzeltme', () => {
  it('ağırlık ve tekrarı düzeltir, girdiyi değiştirmez', () => {
    const w = wk([{ exId: 'a', sets: [set(60, 5), set(60, 5)] }])
    const out = editSet(w, 0, 1, { w: 62.5, r: 6 })
    expect(out.entries[0].sets[1]).toMatchObject({ w: 62.5, r: 6, done: true })
    expect(out.entries[0].sets[0]).toEqual(set(60, 5))
    expect(w.entries[0].sets[1]).toEqual(set(60, 5))
  })

  it('negatif ve geçersiz değeri 0 yapar, tekrarı tam sayıya yuvarlar', () => {
    const w = wk([{ exId: 'a', sets: [set(60, 5)] }])
    expect(editSet(w, 0, 0, { w: -3, r: 7.6 }).entries[0].sets[0]).toMatchObject({ w: 0, r: 8 })
    expect(editSet(w, 0, 0, { w: NaN, r: NaN }).entries[0].sets[0]).toMatchObject({ w: 0, r: 0 })
  })

  it('tek taraflıda sol/sağı ayrı düzeltir, set tekrarı zayıf tarafa göre türer', () => {
    const w = wk([{ exId: 'a', unilateral: true, sets: [uni(20, 10, 8)] }])
    const out = editSet(w, 0, 0, { L: 6 }).entries[0].sets[0]
    expect(out.sides).toMatchObject({ L: { r: 6 }, R: { r: 8 } })
    expect(out.r).toBe(6)
    expect(out.done).toBe(true)
  })

  it('tek taraflıda r yamasını yok sayar', () => {
    const w = wk([{ exId: 'a', unilateral: true, sets: [uni(20, 10, 8)] }])
    expect(editSet(w, 0, 0, { r: 99 }).entries[0].sets[0].r).toBe(8)
  })

  it('yarım setin eksik tarafı girilince tam sete dönüşür', () => {
    const partial: SetEntry = {
      w: 20,
      r: 0,
      done: false,
      partial: true,
      sides: { L: { r: 8, done: true }, R: { r: 0, done: false } },
    }
    const w = wk([{ exId: 'a', unilateral: true, sets: [partial] }])
    const out = editSet(w, 0, 0, { R: 7 }).entries[0].sets[0]
    expect(out.partial).toBeUndefined()
    expect(out).toMatchObject({ done: true, r: 7 })
    expect(out.sides).toMatchObject({ L: { r: 8, done: true }, R: { r: 7, done: true } })
  })

  it('yarım setin yapılan tarafını düzeltmek yarım kalmasını bozmaz', () => {
    const partial: SetEntry = {
      w: 20,
      r: 0,
      done: false,
      partial: true,
      sides: { L: { r: 8, done: true }, R: { r: 0, done: false } },
    }
    const out = editSet(wk([{ exId: 'a', unilateral: true, sets: [partial] }]), 0, 0, { L: 9 }).entries[0].sets[0]
    expect(out.partial).toBe(true)
    expect(out.done).toBe(false)
  })
})

describe('set ekleme ve silme', () => {
  it('son çalışma setinin kopyasını tamamlanmış olarak ekler', () => {
    const w = wk([{ exId: 'a', sets: [set(20, 8, { warmup: true }), set(60, 5), set(40, 6, { drop: true })] }])
    const added = addSetTo(w, 0).entries[0].sets
    expect(added).toHaveLength(4)
    expect(added[3]).toEqual({ w: 60, r: 5, done: true })
  })

  it('tek taraflı seti sol/sağ hedefleriyle çoğaltır', () => {
    const w = wk([{ exId: 'a', unilateral: true, sets: [uni(20, 10, 8)] }])
    const added = addSetTo(w, 0).entries[0].sets[1]
    expect(added.sides).toMatchObject({ L: { r: 10, done: true }, R: { r: 8, done: true } })
    expect(added.r).toBe(8)
  })

  it('hiç çalışma seti yoksa sıfırlı bir set ekler', () => {
    expect(addSetTo(wk([{ exId: 'a', sets: [] }]), 0).entries[0].sets).toEqual([{ w: 0, r: 0, done: true }])
  })

  it('seti siler, diğerlerine dokunmaz', () => {
    const w = wk([{ exId: 'a', sets: [set(1, 1), set(2, 2), set(3, 3)] }])
    expect(removeSetAt(w, 0, 1).entries[0].sets.map((s) => s.w)).toEqual([1, 3])
  })
})

describe('egzersiz silme', () => {
  it('egzersizi çıkarır', () => {
    const w = wk([{ exId: 'a', sets: [set(1, 1)] }, { exId: 'b', sets: [set(1, 1)] }])
    expect(removeEntryAt(w, 0).entries.map((e) => e.exId)).toEqual(['b'])
  })

  it('süpersetin başını çıkarınca ona bağlı egzersizi bağsız yapar', () => {
    const w = wk([
      { exId: 'a', sets: [set(1, 1)] },
      { exId: 'b', sets: [set(1, 1)], linked: true },
      { exId: 'c', sets: [set(1, 1)] },
    ])
    expect(removeEntryAt(w, 0).entries.map((e) => !!e.linked)).toEqual([false, false])
  })

  it('süpersetin ortasındakini çıkarınca gruba dokunmaz', () => {
    const w = wk([
      { exId: 'a', sets: [set(1, 1)] },
      { exId: 'b', sets: [set(1, 1)], linked: true },
      { exId: 'c', sets: [set(1, 1)], linked: true },
    ])
    expect(removeEntryAt(w, 1).entries.map((e) => !!e.linked)).toEqual([false, true])
  })
})

describe('kaydetmeye hazırlama', () => {
  it('notları kırpar, boş notu atar', () => {
    const w = setWorkoutNoteIn(setEntryNoteIn(wk([{ exId: 'a', sets: [set(1, 1)] }]), 0, '  ağrı  '), '   ')
    const out = finalizeEdit(w)!
    expect(out.entries[0].note).toBe('ağrı')
    expect(Object.keys(out)).not.toContain('note')
  })

  it('setsiz ve notsuz egzersizi atar, notlu setsizi tutar', () => {
    const w = wk([
      { exId: 'a', sets: [set(1, 1)] },
      { exId: 'b', sets: [] },
      { exId: 'c', sets: [], note: 'yapamadım' },
    ])
    expect(finalizeEdit(w)!.entries.map((e) => e.exId)).toEqual(['a', 'c'])
  })

  it('hiç çalışma seti kalmadıysa null verir', () => {
    expect(finalizeEdit(wk([{ exId: 'a', sets: [set(1, 1, { warmup: true })] }]))).toBeNull()
    expect(finalizeEdit(wk([{ exId: 'a', sets: [], note: 'x' }]))).toBeNull()
  })
})
