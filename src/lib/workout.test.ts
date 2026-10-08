import { describe, expect, it } from 'vitest'
import type { Routine, Workout } from '../store/schema.ts'
import { deriveSet } from './sets.ts'
import {
  buildWorkout,
  dayString,
  doneSetCount,
  exerciseHistory,
  finalizeSet,
  isPR,
  lastEntryFor,
  partialSetCount,
  workoutVolume,
} from './workout.ts'

const done = (w: number, r: number) => ({ w, r, done: true })

function wk(d: string, exId: string, sets: Workout['entries'][number]['sets']): Workout {
  return { id: d, d, start: 0, name: 't', entries: [{ exId, sets }] }
}

const routine: Routine = {
  id: 'r1',
  name: 'Push',
  ex: [{ exId: 'bench', sets: 3, reps: 5, weight: 60, prog: 'linear', inc: 2.5, repsMax: 8 }],
}

describe('workout yardımcıları', () => {
  it('yerel günü YYYY-MM-DD yazar', () => {
    expect(dayString(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08')
  })

  it('geçmiş yokken plan ağırlığıyla başlar', () => {
    const w = buildWorkout(routine, [], Date.UTC(2026, 9, 8, 12))
    expect(w.entries[0].sets).toHaveLength(3)
    expect(w.entries[0].sets[0]).toEqual({ w: 60, r: 5, done: false })
  })

  it('başarılı geçmişte progression ağırlığı artırır', () => {
    const history = [wk('2026-10-01', 'bench', [done(60, 5), done(60, 5), done(60, 5)])]
    const w = buildWorkout(routine, history, Date.UTC(2026, 9, 8, 12))
    expect(w.entries[0].sets[0].w).toBe(62.5)
  })

  it('son kaydı bulurken tamamlanmamış seansı atlar', () => {
    const history = [
      wk('2026-10-01', 'bench', [done(60, 5)]),
      wk('2026-10-05', 'bench', [{ w: 70, r: 5, done: false }]),
    ]
    expect(lastEntryFor(history, 'bench')?.sets[0].w).toBe(60)
  })

  it('hacmi yalnız tamamlanan çalışma setlerinden hesaplar', () => {
    const w = wk('2026-10-08', 'bench', [
      done(100, 5),
      { w: 100, r: 5, done: false },
      { w: 20, r: 10, done: true, warmup: true },
    ])
    expect(workoutVolume(w)).toBe(500)
    expect(doneSetCount(w)).toEqual({ done: 1, total: 2 })
  })

  it('egzersiz geçmişini seans başına tek noktaya indirir', () => {
    const history = [wk('2026-10-01', 'bench', [done(60, 5), done(62.5, 3)])]
    const [p] = exerciseHistory(history, 'bench')
    expect(p.topW).toBe(62.5)
    expect(p.e1rm).toBeCloseTo(70, 0)
  })

  it('PR yalnız önceki en iyiyi aşınca verilir', () => {
    const prev = [wk('2026-10-01', 'bench', [done(100, 5)])]
    expect(isPR(prev, wk('2026-10-08', 'bench', [done(102.5, 5)]).entries[0])).toBe(true)
    expect(isPR(prev, wk('2026-10-08', 'bench', [done(100, 5)]).entries[0])).toBe(false)
  })

  it('ilk kayıt PR sayılır', () => {
    expect(isPR([], wk('2026-10-08', 'bench', [done(40, 8)]).entries[0])).toBe(true)
  })
})

describe('ısınma ve dropset', () => {
  const heavy: Routine = {
    id: 'r3',
    name: 'İtiş',
    ex: [{ exId: 'bench', sets: 2, reps: 5, weight: 100, prog: 'linear', inc: 2.5, repsMax: 5, warmups: 3, drops: 2 }],
  }

  it('sırayla ısınma, çalışma ve drop setlerini kurar', () => {
    const [e] = buildWorkout(heavy, [], Date.UTC(2026, 9, 8, 12)).entries
    expect(e.sets.map((s) => (s.warmup ? 'W' : s.drop ? 'D' : 'S')).join('')).toBe('WWWSSDD')
    expect(e.sets.slice(0, 3).map((s) => s.w)).toEqual([40, 60, 80])
    expect(e.sets.slice(3, 5).map((s) => s.w)).toEqual([100, 100])
    expect(e.sets.slice(5).map((s) => s.w)).toEqual([80, 65])
  })

  it('ısınma ağırlığı progression önerisinden hesaplanır', () => {
    const history = [wk('2026-10-01', 'bench', [done(100, 5), done(100, 5)])]
    const [e] = buildWorkout(heavy, history, Date.UTC(2026, 9, 8, 12)).entries
    expect(e.sets[3].w).toBe(102.5)
    expect(e.sets[2].w).toBe(82.5) // 102,5 × 0,8 = 82 → 2,5 adıma yuvarlanır
  })

  it('ısınma/drop yoksa eski davranışı korur', () => {
    const plain: Routine = { id: 'p', name: 'x', ex: [{ ...heavy.ex[0], warmups: undefined, drops: undefined }] }
    expect(buildWorkout(plain, [], 1).entries[0].sets).toHaveLength(2)
  })

  it('tek taraflıda ısınma tek satırlı, çalışma ve drop setleri sol/sağlı olur', () => {
    const uni: Routine = { id: 'u', name: 'x', ex: [{ ...heavy.ex[0], weight: 20, side: true, warmups: 1, drops: 1 }] }
    const sets = buildWorkout(uni, [], 1).entries[0].sets
    expect(sets[0].warmup).toBe(true)
    expect(sets[0].sides).toBeUndefined()
    expect(sets[1].sides).toBeDefined()
    expect(sets[sets.length - 1]).toMatchObject({ drop: true })
    expect(sets[sets.length - 1].sides).toBeDefined()
  })

  it('ilerleme sayacı ısınma ve dropsetleri saymaz', () => {
    const w = buildWorkout(heavy, [], 1)
    expect(doneSetCount(w)).toEqual({ done: 0, total: 2 })
  })

  it('hacim dropsetleri içerir, ısınmayı içermez', () => {
    const w = wk('2026-10-08', 'bench', [
      { w: 40, r: 8, done: true, warmup: true },
      done(100, 5),
      { w: 80, r: 6, done: true, drop: true },
    ])
    expect(workoutVolume(w)).toBe(100 * 5 + 80 * 6)
  })
})

describe('tek taraflı egzersizler', () => {
  const unilateralRoutine: Routine = {
    id: 'r2',
    name: 'Bacak',
    ex: [{ exId: 'split', sets: 2, reps: 8, weight: 20, prog: 'double', inc: 2, repsMax: 12, side: true }],
  }
  const uniSet = (w: number, l: number, r: number) =>
    deriveSet({ w, r: 0, done: false, sides: { L: { r: l, done: true }, R: { r, done: true } } })

  it('rutinden tek taraflı set kurar', () => {
    const w = buildWorkout(unilateralRoutine, [], Date.UTC(2026, 9, 8, 12))
    expect(w.entries[0].unilateral).toBe(true)
    expect(w.entries[0].sets[0].sides).toEqual({ L: { r: 8, done: false }, R: { r: 8, done: false } })
  })

  it('hacmi sol + sağ tekrarlardan hesaplar', () => {
    const w = wk('2026-10-08', 'split', [uniSet(20, 10, 8)])
    w.entries[0].unilateral = true
    expect(workoutVolume(w)).toBe(20 * 18)
  })

  it('1RM tahmini taraf başına (zayıf taraf) tekrarı kullanır, toplamı değil', () => {
    const [p] = exerciseHistory([wk('2026-10-08', 'split', [uniSet(20, 10, 8)])], 'split')
    // 20 kg × 8 tekrar (zayıf taraf) = 25.33; toplam 18 tekrar sayılsaydı tavan 12'ye takılıp 28 çıkardı.
    expect(p.e1rm).toBeCloseTo(20 * (1 + 8 / 30), 2)
  })

  it('yalnız bir tarafı biten set geçmişte çalışma seti sayılmaz', () => {
    const half = deriveSet({ w: 20, r: 0, done: false, sides: { L: { r: 10, done: true }, R: { r: 10, done: false } } })
    expect(exerciseHistory([wk('2026-10-08', 'split', [half])], 'split')).toEqual([])
  })

  it('progression zayıf tarafa göre ilerler', () => {
    const history = [wk('2026-10-01', 'split', [uniSet(20, 12, 10), uniSet(20, 12, 10)])]
    const w = buildWorkout(unilateralRoutine, history, Date.UTC(2026, 9, 8, 12))
    // zayıf taraf 10 < üst sınır 12 → ağırlık artmaz, hedef 11 tekrar
    expect(w.entries[0].sets[0].sides?.L.r).toBe(11)
    expect(w.entries[0].sets[0].w).toBe(20)
  })
})

describe('süperset', () => {
  const cfg = (exId: string, superset?: boolean) => ({
    exId,
    sets: 2,
    reps: 8,
    weight: 20,
    prog: 'off' as const,
    inc: 0,
    repsMax: 8,
    superset,
  })

  it('rutindeki süperset bayrağını seans egzersizine taşır', () => {
    const r: Routine = { id: 'r3', name: 'Üst', ex: [cfg('a'), cfg('b', true), cfg('c')] }
    const w = buildWorkout(r, [], Date.UTC(2026, 9, 8, 12))
    expect(w.entries.map((e) => !!e.linked)).toEqual([false, true, false])
  })

  it('ilk egzersizin bayrağını yok sayar', () => {
    const r: Routine = { id: 'r3', name: 'Üst', ex: [cfg('a', true), cfg('b', true)] }
    const w = buildWorkout(r, [], Date.UTC(2026, 9, 8, 12))
    expect(w.entries.map((e) => !!e.linked)).toEqual([false, true])
  })
})

describe('yarım tek taraflı set', () => {
  const half = (l: number, r: number, doneL: boolean, doneR: boolean) =>
    deriveSet({ w: 20, r: 0, done: false, sides: { L: { r: l, done: doneL }, R: { r, done: doneR } } })

  it('bir tarafı yapılmış seti yarım set olarak saklar, yapılmayan tarafın tekrarını sıfırlar', () => {
    expect(finalizeSet(half(8, 8, true, false))).toMatchObject({
      r: 0,
      done: false,
      partial: true,
      sides: { L: { r: 8, done: true }, R: { r: 0, done: false } },
    })
    expect(finalizeSet(half(8, 6, false, true))).toMatchObject({
      partial: true,
      sides: { L: { r: 0, done: false }, R: { r: 6, done: true } },
    })
  })

  it('hiç yapılmamış, tam yapılmış ve tekrarsız seti yarım saymaz', () => {
    expect(finalizeSet(half(8, 8, false, false))).toBeNull()
    expect(finalizeSet(half(0, 8, true, false))).toBeNull()
    const full = half(8, 8, true, true)
    expect(finalizeSet(full)).toBe(full)
  })

  it('tek taraflı olmayan tamamlanmamış seti ve ısınmayı atar', () => {
    expect(finalizeSet({ w: 60, r: 5, done: false })).toBeNull()
    expect(finalizeSet({ w: 20, r: 5, done: false, warmup: true })).toBeNull()
  })

  it('hacme yapılan tarafı katar, 1RM ve PR geçmişine katmaz', () => {
    const partial = finalizeSet(half(8, 8, true, false))!
    const wk: Workout = { id: 'p', d: '2026-10-01', start: 0, name: 't', entries: [{ exId: 'split', unilateral: true, sets: [partial] }] }
    expect(workoutVolume(wk)).toBe(160)
    expect(exerciseHistory([wk], 'split')).toEqual([])
    expect(lastEntryFor([wk], 'split')).toBeUndefined()
    expect(partialSetCount(wk)).toBe(1)
    expect(doneSetCount(wk).done).toBe(0)
  })
})
