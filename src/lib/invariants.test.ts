import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../store/backup.ts'
import { migrate } from '../store/migrate.ts'
import { defaultState, type SetEntry, type State, type Workout, type WorkoutEntry } from '../store/schema.ts'
import { mergeState, totalAdded } from './mergeBackup.ts'
import { workoutsToCsv } from './exportCsv.ts'
import { DEFAULT_KITS, platesFor } from './plates.ts'
import { deriveSet } from './sets.ts'
import { formatWeight, kgToUnit, unitToKg } from './units.ts'
import { doneSetCount, finalizeSet, workoutVolume } from './workout.ts'

/** Tohumlu, tekrarlanabilir sözde rastgele sayı üreteci (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  }
}
type Rng = ReturnType<typeof rng>

const EX_IDS = ['bench', 'squat', 'row', 'curl', 'pullup', 'Unknown_Move']

function genSet(r: Rng, bw: boolean): SetEntry {
  const w = bw ? r.int(-40, 40) * 0.5 : r.int(0, 400) * 0.5
  const reps = r.int(1, 30)
  const base: SetEntry = { w, r: reps, done: r.chance(0.8) }
  if (r.chance(0.3)) base.rir = r.int(0, 4)
  if (r.chance(0.15)) base.warmup = true
  else if (r.chance(0.1)) base.drop = true
  if (!base.warmup && r.chance(0.25)) {
    const l = r.int(1, 20)
    const rr = r.int(1, 20)
    return deriveSet({ ...base, sides: { L: { r: l, done: r.chance(0.8) }, R: { r: rr, done: r.chance(0.8) } } })
  }
  return base
}

function genEntry(r: Rng): WorkoutEntry {
  const bw = r.chance(0.2)
  const e: WorkoutEntry = {
    exId: r.pick(EX_IDS),
    sets: Array.from({ length: r.int(0, 6) }, () => genSet(r, bw)),
  }
  if (bw) {
    e.bw = true
    if (r.chance(0.8)) e.bwKg = r.int(500, 1100) / 10
  }
  if (r.chance(0.2)) e.linked = true
  if (r.chance(0.15)) e.unilateral = e.sets.some((s) => s.sides)
  if (r.chance(0.2)) e.note = r.pick(['ağrı', '=SUM(A1)', 'çok; ağır\n"tırnak"', '  boşluk  '])
  if (r.chance(0.2)) e.restSec = r.int(20, 240)
  return e
}

function genState(r: Rng): State {
  const s = defaultState()
  const pad = (n: number) => String(n).padStart(2, '0')
  s.workouts = Array.from({ length: r.int(0, 12) }, (_, i): Workout => {
    const d = `2026-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`
    const start = Date.UTC(2026, 0, 1) + i * 86_400_000
    const w: Workout = { id: `w${i}`, d, start, name: `Antrenman ${i}`, entries: Array.from({ length: r.int(0, 5) }, () => genEntry(r)) }
    if (r.chance(0.8)) w.end = start + r.int(20, 120) * 60_000
    if (r.chance(0.2)) w.note = 'iyi gün'
    return w
  })
  s.bodyweight = Array.from({ length: r.int(0, 5) }, (_, i) => ({ d: `2026-${pad(i + 1)}-10`, w: r.int(600, 1100) / 10 }))
  s.routines = [{ id: 'r1', name: 'Rutin', ex: [{ exId: 'bench', sets: 3, reps: 8, weight: 60, prog: 'double', inc: 2.5, repsMax: 12, restSec: 120 }] }]
  s.week = { 1: 'r1' }
  s.customEx = [{ id: 'c1', name: 'Özel', primaryMuscles: ['chest'], equipment: 'cable' }]
  return s
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i)

describe('rastgele geçerli veriyle değişmezler', () => {
  it('üreteç gerçekten çeşitli veri üretir (testler boş geçmez)', () => {
    const states = SEEDS.map((seed) => genState(rng(seed)))
    const sets = states.flatMap((s) => s.workouts.flatMap((w) => w.entries.flatMap((e) => e.sets)))
    expect(sets.length).toBeGreaterThan(500)
    expect(sets.some((x) => x.sides)).toBe(true)
    expect(sets.some((x) => x.warmup)).toBe(true)
    expect(sets.some((x) => x.drop)).toBe(true)
    expect(sets.some((x) => x.w < 0)).toBe(true)
    expect(sets.some((x) => !x.done)).toBe(true)
    expect(states.some((s) => s.workouts.some((w) => w.entries.some((e) => e.note?.startsWith('='))))).toBe(true)
  })

  it('geçerli state migrate ve yedek gidiş-dönüşünden değişmeden çıkar', () => {
    for (const seed of SEEDS) {
      const s = clone(genState(rng(seed)))
      expect(migrate(clone(s)), `seed ${seed} migrate`).toEqual(s)
      expect(importBackup(exportBackup(s)), `seed ${seed} yedek`).toEqual(s)
    }
  })

  it('kendisiyle birleştirmek hiçbir şey eklemez; ikinci birleştirme de eklemez', () => {
    for (const seed of SEEDS) {
      const a = clone(genState(rng(seed)))
      const b = clone(genState(rng(seed + 5000)))
      expect(totalAdded(mergeState(a, clone(a)).report), `seed ${seed} kendisi`).toBe(0)
      const once = mergeState(a, b)
      const twice = mergeState(once.state, b)
      expect(totalAdded(twice.report), `seed ${seed} ikinci`).toBe(0)
    }
  })

  it('birleştirme yerel antrenmanları silmez ve kimlikleri çoğaltmaz', () => {
    for (const seed of SEEDS) {
      const a = clone(genState(rng(seed)))
      const b = clone(genState(rng(seed + 9000)))
      const { state } = mergeState(a, b)
      const ids = state.workouts.map((w) => w.id)
      expect(new Set(ids).size, `seed ${seed} tekrar`).toBe(ids.length)
      for (const w of a.workouts) expect(ids, `seed ${seed} kayıp`).toContain(w.id)
    }
  })

  it('hacim eksi olmaz, tamamlanan set toplamı aşmaz, finalizeSet tutarlıdır', () => {
    for (const seed of SEEDS) {
      for (const w of genState(rng(seed)).workouts) {
        expect(workoutVolume(w), `seed ${seed} hacim`).toBeGreaterThanOrEqual(0)
        const { done, total } = doneSetCount(w)
        expect(done).toBeLessThanOrEqual(total)
        for (const e of w.entries) {
          for (const s of e.sets) {
            const f = finalizeSet(s)
            if (f) expect(finalizeSet(f), `seed ${seed} finalize idempotent`).toEqual(f)
            if (s.done) expect(f).toEqual(s)
          }
        }
      }
    }
  })

  it('CSV her satırda aynı sütun sayısını verir ve ham satır sonu sızdırmaz', () => {
    for (const seed of SEEDS) {
      const csv = workoutsToCsv(genState(rng(seed)).workouts, { unit: seed % 2 ? 'lb' : 'kg', names: (id) => id })
      // Tırnak içindeki ; ve satır sonları dışında alan sayısı sabit: tırnaklı alanları çıkarıp say.
      const rows = csv.replace(/﻿/, '').split('\r\n').filter(Boolean)
      let record = ''
      let open = false
      const records: string[] = []
      for (const line of rows) {
        record = open ? `${record}\n${line}` : line
        open = (record.match(/"/g) ?? []).length % 2 === 1
        if (!open) records.push(record)
      }
      const widths = new Set(records.map((r) => r.replace(/"(?:[^"]|"")*"/g, 'x').split(';').length))
      expect(widths.size, `seed ${seed} sütun sayısı`).toBeLessThanOrEqual(1)
    }
  })
})

describe('rastgele bozuk veri', () => {
  const junk = (r: Rng, depth = 0): unknown => {
    const kinds = depth > 3 ? 6 : 9
    switch (r.int(0, kinds)) {
      case 0: return null
      case 1: return r.int(-1e6, 1e6)
      case 2: return r.pick(['', 'x', '2026-13-45', '__proto__', 'constructor'])
      case 3: return r.chance(0.5)
      case 4: return NaN
      case 5: return Infinity
      case 6: return undefined
      case 7: return Array.from({ length: r.int(0, 4) }, () => junk(r, depth + 1))
      default: {
        const o: Record<string, unknown> = {}
        for (const k of ['id', 'd', 'start', 'end', 'name', 'entries', 'sets', 'w', 'r', 'rir', 'done', 'exId', 'sides', 'L', 'R', 'routines', 'workouts', 'settings', 'unit', 'week', 'bodyweight', 'customEx', 'muscleFix', 'ex', 'restSec', '__proto__'])
          if (r.chance(0.25)) o[k] = junk(r, depth + 1)
        return o
      }
    }
  }

  it('migrate hiçbir girdide hata fırlatmaz, sonuç tekrar migrate edilince değişmez', () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = junk(rng(seed))
      const once = migrate(g)
      expect(migrate(clone(once)), `seed ${seed}`).toEqual(once)
    }
  })

  it('bozuk alanlı gerçekçi state yine de açılır ve geçerli alanları korur', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const r = rng(seed)
      const s = clone(genState(r)) as unknown as Record<string, unknown>
      const wk = s.workouts as Record<string, unknown>[]
      if (wk.length > 0) {
        wk[0].entries = junk(r)
        wk[0].start = 'x'
      }
      const out = migrate(s)
      // Bozulmayan antrenmanlar yerinde kalır.
      for (const w of wk.slice(1)) expect(out.workouts.some((x) => x.id === w.id), `seed ${seed}`).toBe(true)
    }
  })
})

describe('plaka ve birim değişmezleri', () => {
  it('yüklenen toplam bar + 2 × taraf plakaları; hedefi aşmaz, fark tutarlıdır', () => {
    const r = rng(7)
    for (let i = 0; i < 400; i++) {
      const unit = r.pick(['kg', 'lb'] as const)
      const kit = DEFAULT_KITS[unit]
      const target = kit.bar + r.int(0, 4000) / 10
      const res = platesFor(target, kit)
      const side = res.perSide.reduce((n, p) => n + p.plate * p.count, 0)
      expect(res.loaded, `${unit} ${target}`).toBeCloseTo(kit.bar + 2 * side, 6)
      expect(res.loaded).toBeLessThanOrEqual(target + 1e-6)
      expect(res.short).toBeCloseTo(Math.max(0, target - res.loaded), 2)
    }
  })

  it('kg ↔ lb gidiş-dönüşü kaybetmez ve gösterim hep geçerli sayıdır', () => {
    const r = rng(11)
    for (let i = 0; i < 400; i++) {
      const kg = r.int(0, 6000) / 10
      expect(unitToKg(kgToUnit(kg, 'lb'), 'lb')).toBeCloseTo(kg, 6)
      for (const unit of ['kg', 'lb'] as const) expect(formatWeight(kg, unit)).toMatch(/^\d+(,\d)?$/)
    }
  })
})
