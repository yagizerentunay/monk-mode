import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import { makeSides } from './sets.ts'
import {
  applyRirToEntry,
  isRirSet,
  missingRirByExercise,
  missingRirCount,
  previousRir,
  rirCoverage,
  rirLabel,
} from './rir.ts'

const work = (rir?: number, done = true): SetEntry => ({ w: 60, r: 8, done, ...(rir !== undefined ? { rir } : {}) })
const warmup = (): SetEntry => ({ w: 20, r: 8, done: true, warmup: true })
const drop = (rir?: number): SetEntry => ({ w: 40, r: 8, done: true, drop: true, ...(rir !== undefined ? { rir } : {}) })

function wk(...entries: SetEntry[][]): Workout {
  return {
    id: 'w1',
    d: '2026-10-09',
    start: 1,
    end: 2,
    name: 'Push',
    entries: entries.map((sets, i) => ({ exId: `ex${i}`, sets })),
  }
}

describe('rirLabel', () => {
  it('4 ve üstünü "4+" yazar', () => {
    expect([0, 1, 2, 3, 4].map(rirLabel)).toEqual(['0', '1', '2', '3', '4+'])
  })
})

describe('isRirSet', () => {
  it('yalnız tamamlanmış çalışma setidir', () => {
    expect(isRirSet(work())).toBe(true)
    expect(isRirSet(work(undefined, false))).toBe(false)
    expect(isRirSet(warmup())).toBe(false)
    expect(isRirSet(drop())).toBe(false)
  })
})

describe('previousRir', () => {
  it('en yakın önceki tamamlanmış çalışma setinin RIR değerini verir', () => {
    expect(previousRir([work(2), work(), work()], 2)).toBeUndefined() // en yakın set (1.) boş: atlanıp 0.'ya bakılmaz
    expect(previousRir([work(2), work(1), work()], 2)).toBe(1)
  })

  it('ilk sette ve öncesi yoksa undefined', () => {
    expect(previousRir([work()], 0)).toBeUndefined()
    expect(previousRir([], 0)).toBeUndefined()
  })

  it('ısınma, dropset ve yapılmamış setleri atlar', () => {
    expect(previousRir([work(3), warmup(), drop(0), work(undefined, false), work()], 4)).toBe(3)
    expect(previousRir([warmup(), work()], 1)).toBeUndefined()
  })

  it('tek taraflı sette (RIR set düzeyinde) aynı çalışır', () => {
    const uni = (rir?: number): SetEntry => ({ ...work(rir), sides: makeSides(8, true) })
    expect(previousRir([uni(1), uni()], 1)).toBe(1)
  })
})

describe('missingRirByExercise / missingRirCount', () => {
  it('0 sette boş döner', () => {
    expect(missingRirByExercise(wk())).toEqual([])
    expect(missingRirCount(wk())).toBe(0)
    expect(missingRirCount(wk([]))).toBe(0)
  })

  it('hepsi doluysa boş döner', () => {
    const w = wk([work(1), work(0)], [work(4)])
    expect(missingRirByExercise(w)).toEqual([])
    expect(missingRirCount(w)).toBe(0)
  })

  it('karışık antrenmanda egzersiz başına eksik sayar, sırayı korur', () => {
    const w = wk([work(1), work(), work()], [work(2)], [work(), work(3)])
    expect(missingRirByExercise(w)).toEqual([
      { entryIdx: 0, exId: 'ex0', count: 2 },
      { entryIdx: 2, exId: 'ex2', count: 1 },
    ])
    expect(missingRirCount(w)).toBe(3)
  })

  it('ısınma, dropset ve yapılmamış setleri saymaz', () => {
    const w = wk([warmup(), work(1), drop(), work(undefined, false)])
    expect(missingRirCount(w)).toBe(0)
  })

  it('tek taraflı tamamlanmış seti bir set sayar; yarım seti saymaz', () => {
    const full: SetEntry = { ...work(), sides: makeSides(8, true) }
    const half: SetEntry = {
      w: 20,
      r: 0,
      done: false,
      partial: true,
      sides: { L: { r: 8, done: true }, R: { r: 0, done: false } },
    }
    const w = wk([full, half])
    expect(missingRirByExercise(w)).toEqual([{ entryIdx: 0, exId: 'ex0', count: 1 }])
  })
})

describe('rirCoverage', () => {
  it('set yoksa pct null', () => {
    expect(rirCoverage(wk())).toEqual({ withRir: 0, total: 0, pct: null })
    expect(rirCoverage(wk([warmup(), drop()]))).toEqual({ withRir: 0, total: 0, pct: null })
  })

  it('hepsi doluysa %100, hiçbiri yoksa %0', () => {
    expect(rirCoverage(wk([work(0), work(2)])).pct).toBe(100)
    expect(rirCoverage(wk([work(), work()])).pct).toBe(0)
  })

  it('karışıkta yuvarlar ve ısınma/dropu paydaya katmaz', () => {
    const w = wk([work(1), work(), work(), warmup(), drop(2), work(undefined, false)])
    expect(rirCoverage(w)).toEqual({ withRir: 1, total: 3, pct: 33 })
    expect(rirCoverage(wk([work(1), work(1), work()])).pct).toBe(67)
  })

  it('RIR 0 doldurulmuş sayılır', () => {
    expect(rirCoverage(wk([work(0), work()])).pct).toBe(50)
  })
})

describe('applyRirToEntry', () => {
  it('yalnız o egzersizin RIR\'i boş çalışma setlerine yazar', () => {
    const w = wk([work(), work(1), warmup(), drop(), work(undefined, false)], [work()])
    const out = applyRirToEntry(w, 0, 2)
    expect(out.entries[0].sets.map((s) => s.rir)).toEqual([2, 1, undefined, undefined, undefined])
    expect(out.entries[1].sets[0].rir).toBeUndefined()
    expect(missingRirCount(out)).toBe(1)
  })

  it('id, sıra, tarih ve diğer alanları korur', () => {
    const w = wk([work()])
    const out = applyRirToEntry(w, 0, 0)
    expect(out).toMatchObject({ id: 'w1', d: '2026-10-09', start: 1, end: 2, name: 'Push' })
    expect(out.entries[0].exId).toBe('ex0')
    expect(out.entries[0].sets[0]).toEqual({ w: 60, r: 8, done: true, rir: 0 })
  })

  it('tek taraflı setin yan verisini bozmaz', () => {
    const uni: SetEntry = { ...work(), sides: makeSides(8, true) }
    const out = applyRirToEntry(wk([uni]), 0, 3)
    expect(out.entries[0].sets[0]).toEqual({ ...uni, rir: 3 })
  })

  it('girdiyi değiştirmez', () => {
    const w = wk([work(), work(1)])
    const snapshot = structuredClone(w)
    const out = applyRirToEntry(w, 0, 4)
    expect(w).toEqual(snapshot)
    expect(out).not.toBe(w)
    expect(out.entries[0]).not.toBe(w.entries[0])
    expect(out.entries[0].sets[1]).toBe(w.entries[0].sets[1]) // dokunulmayan set paylaşılır
  })

  it('uygulanacak bir şey yoksa ya da sıra geçersizse aynı nesneyi döndürür', () => {
    const w = wk([work(1)])
    expect(applyRirToEntry(w, 0, 2)).toBe(w)
    expect(applyRirToEntry(w, 5, 2)).toBe(w)
    expect(applyRirToEntry(w, -1, 2)).toBe(w)
  })
})
