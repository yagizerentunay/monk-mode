import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import {
  addSetTo,
  editSet,
  finalizeEdit,
  moveEntryAt,
  removeEntryAt,
  removeSetAt,
  setEntryBwKgIn,
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

  it('vücut ağırlığı egzersizinde negatif (asist) ek yükü kabul eder, diğerinde sıfıra çeker', () => {
    const w = wk([
      { exId: 'pullup', bw: true, bwKg: 67, sets: [set(0, 5)] },
      { exId: 'row', sets: [set(40, 8)] },
    ])
    expect(editSet(w, 0, 0, { w: -20 }).entries[0].sets[0].w).toBe(-20)
    expect(editSet(w, 0, 0, { w: NaN }).entries[0].sets[0].w).toBe(0)
    expect(editSet(w, 1, 0, { w: -20 }).entries[1].sets[0].w).toBe(0)
    // bw bayrakları düzenlemeden etkilenmez.
    expect(editSet(w, 0, 0, { w: -20 }).entries[0]).toMatchObject({ bw: true, bwKg: 67 })
  })

  it('hiç çalışma seti kalmadıysa null verir', () => {
    expect(finalizeEdit(wk([{ exId: 'a', sets: [set(1, 1, { warmup: true })] }]))).toBeNull()
    expect(finalizeEdit(wk([{ exId: 'a', sets: [], note: 'x' }]))).toBeNull()
  })
})

describe('kaydedilmiş antrenmanda vücut ağırlığı', () => {
  const base: Workout = {
    id: 'w1',
    d: '2026-10-01',
    start: 1,
    name: 'Pull',
    entries: [
      { exId: 'pullup', bw: true, bwKg: 70, sets: [{ w: 0, r: 8, done: true }] },
      { exId: 'row', sets: [{ w: 40, r: 8, done: true }] },
    ],
  }

  it('bw egzersizinde vücut ağırlığını değiştirir', () => {
    expect(setEntryBwKgIn(base, 0, 72.5).entries[0].bwKg).toBe(72.5)
  })

  it('0 kaydı kaldırır ("bilinmiyor")', () => {
    expect(setEntryBwKgIn(base, 0, 0).entries[0]).not.toHaveProperty('bwKg')
  })

  it('bw olmayan egzersize dokunmaz', () => {
    expect(setEntryBwKgIn(base, 1, 80).entries[1]).toBe(base.entries[1])
  })
})

describe('egzersiz taşıma (moveEntryAt)', () => {
  const e = (exId: string, linked?: boolean, over: Partial<Workout['entries'][number]> = {}): Workout['entries'][number] => ({
    exId,
    sets: [set(10, 5)],
    ...(linked === undefined ? {} : { linked }),
    ...over,
  })
  const ids = (w: Workout) => w.entries.map((x) => x.exId).join('')
  const links = (w: Workout) => w.entries.map((x) => !!x.linked)

  it('süpersetsizde iki egzersizin yerini değiştirir, girdiyi değiştirmez', () => {
    const w = wk([e('a'), e('b'), e('c')])
    const out = moveEntryAt(w, 1, -1)
    expect(ids(out)).toBe('bac')
    expect(ids(w)).toBe('abc')
    expect(ids(moveEntryAt(w, 1, 1))).toBe('acb')
  })

  it('uçta ve geçersiz sırada aynı antrenmanı döner', () => {
    const w = wk([e('a'), e('b')])
    expect(moveEntryAt(w, 0, -1)).toBe(w)
    expect(moveEntryAt(w, 1, 1)).toBe(w)
    expect(moveEntryAt(w, 5, -1)).toBe(w)
    expect(moveEntryAt(wk([]), 0, 1).entries).toEqual([])
  })

  it('setleri, tamamlanma durumunu ve notu egzersizle birlikte taşır', () => {
    const done = { w: 50, r: 8, done: true }
    const w = wk([e('a', undefined, { sets: [done, { w: 50, r: 8, done: false }], note: 'omuz', unilateral: false, restSec: 90 }), e('b')])
    const out = moveEntryAt(w, 0, 1)
    expect(out.entries[1]).toEqual(w.entries[0])
    expect(out.entries[1].sets[0].done).toBe(true)
    expect(out.entries[1].note).toBe('omuz')
  })

  it('bağ bayrakları konumda kalır; ilk egzersizde bayrak oluşmaz', () => {
    const w = wk([e('a'), e('b', true), e('c')])
    const out = moveEntryAt(w, 0, 1)
    expect(ids(out)).toBe('bac')
    expect(links(out)).toEqual([false, true, false])
    expect('linked' in out.entries[0]).toBe(false)
  })

  describe('süperset grubu [A, B(bağlı), C(bağlı)] + D', () => {
    const w = () => wk([e('a'), e('b', true), e('c', true), e('d')])

    it('grubun başı aşağı: aynı üyeler, grup bozulmaz', () => {
      const out = moveEntryAt(w(), 0, 1)
      expect(ids(out)).toBe('bacd')
      expect(links(out)).toEqual([false, true, true, false])
    })

    it('ortadaki yukarı/aşağı: grup içinde sıra değişir', () => {
      expect(ids(moveEntryAt(w(), 1, -1))).toBe('bacd')
      expect(links(moveEntryAt(w(), 1, -1))).toEqual([false, true, true, false])
      expect(ids(moveEntryAt(w(), 1, 1))).toBe('acbd')
      expect(links(moveEntryAt(w(), 1, 1))).toEqual([false, true, true, false])
    })

    it('grubun kuyruğu aşağı: gruptan çıkar, D gruba girer', () => {
      const out = moveEntryAt(w(), 2, 1)
      expect(ids(out)).toBe('abdc')
      expect(links(out)).toEqual([false, true, true, false])
      // C artık yalnız: D grubun son üyesi.
      expect(out.entries[3].exId).toBe('c')
    })

    it('grubun dışındaki egzersiz yukarı: gruba kuyruk olarak girer, eski kuyruk dışarıda kalır', () => {
      const out = moveEntryAt(w(), 3, -1)
      expect(ids(out)).toBe('abdc')
      expect(links(out)).toEqual([false, true, true, false])
    })

    it('grubun başı yukarı (öncesinde başka egzersiz): komşu grubun başına geçer', () => {
      const w2 = wk([e('x'), e('a'), e('b', true)])
      const out = moveEntryAt(w2, 1, -1)
      expect(ids(out)).toBe('axb')
      expect(links(out)).toEqual([false, false, true])
    })

    it('iki egzersizlik grubun kuyruğu yukarı: sıra döner, grup korunur', () => {
      const out = moveEntryAt(wk([e('a'), e('b', true)]), 1, -1)
      expect(ids(out)).toBe('ba')
      expect(links(out)).toEqual([false, true])
    })
  })

  it('taşıma sonrası supersetInfo her zaman tutarlı gruplar üretir (ilk bağsız)', () => {
    let w = wk([e('a'), e('b', true), e('c'), e('d', true), e('e', true)])
    for (const [i, dir] of [[0, 1], [3, -1], [4, -1], [2, 1], [1, 1], [0, 1]] as const) {
      w = moveEntryAt(w, i, dir)
      expect(w.entries[0].linked).toBeFalsy()
      expect(w.entries).toHaveLength(5)
      expect(new Set(w.entries.map((x) => x.exId)).size).toBe(5)
    }
  })
})
