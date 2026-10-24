import { describe, expect, it } from 'vitest'
import { exportBackup, importBackupWithReport } from '../store/backup.ts'
import { migrateWithReport } from '../store/migrate.ts'
import { droppedTotal, repairedTotal } from '../store/sanitize.ts'
import { defaultState, type State, type Workout, type WorkoutEntry } from '../store/schema.ts'
import { detectDeload } from './deload.ts'
import {
  formatDistance,
  formatDistanceSet,
  formatLongClock,
  formatPace,
  kmToMeters,
  parseLongDuration,
} from './distance.ts'
import { editSet } from './editWorkout.ts'
import { exerciseSummary } from './exerciseStats.ts'
import { isDistanceName } from './exercises.ts'
import { mergeState } from './mergeBackup.ts'
import { sanitizeRoutine } from './mergeRoutines.ts'
import { detectPlateau } from './plateau.ts'
import { nextPrescription } from './progression.ts'
import { personalRecords } from './records.ts'
import { missingRirCount, rirCoverage } from './rir.ts'
import { defaultExCfg } from './routineAdd.ts'
import { swapEntry, toggleDistanceEntry } from './swap.ts'
import { buildWorkout, exerciseHistory, hasVolume, isPR, lastSetup, workoutVolume } from './workout.ts'
import { isZeroWeightSet } from './zeroWeight.ts'

const run = (sets: [number, number][]): WorkoutEntry => ({
  exId: 'run',
  distance: true,
  sets: sets.map(([m, r]) => ({ w: 0, r, m, done: true })),
})
const wk = (id: string, d: string, entries: WorkoutEntry[]): Workout => ({ id, d, start: Date.parse(`${d}T08:00`), name: 'K', entries })
const bench: WorkoutEntry = { exId: 'bench', sets: [{ w: 60, r: 8, done: true }] }

describe('lib/distance yardımcıları', () => {
  it('mesafe, süre ve tempo biçimleri', () => {
    expect(formatDistance(800)).toBe('800 m')
    expect(formatDistance(5000)).toBe('5 km')
    expect(formatDistance(5250)).toBe('5,25 km')
    expect(formatLongClock(1650)).toBe('27:30')
    expect(formatLongClock(3930)).toBe('1:05:30')
    expect(formatPace(5000, 1650)).toBe('5:30 /km')
    expect(formatPace(0, 1650)).toBe('')
    expect(formatDistanceSet({ m: 5000, r: 1650 })).toBe('5 km · 27:30 · 5:30 /km')
    expect(formatDistanceSet({ m: 800, r: 0 })).toBe('800 m')
  })

  it('kardiyo süresi: düz sayı dakika, d:ss ve s:dd:ss; sınır 24 saat', () => {
    expect(parseLongDuration('30')).toBe(1800)
    expect(parseLongDuration('12,5')).toBe(750)
    expect(parseLongDuration('45:30')).toBe(2730)
    expect(parseLongDuration('1:05:30')).toBe(3930)
    expect(parseLongDuration('99:00:00')).toBe(86_400)
    expect(parseLongDuration('1:')).toBeNull()
    expect(parseLongDuration('')).toBeNull()
    expect(kmToMeters(5.2)).toBe(5200)
  })

  it('ad tabanlı varsayılan: kardiyo mesafe, aynı kelimeli kuvvet hareketleri değil', () => {
    for (const n of ['Running', 'Running, Treadmill', 'Rowing (Machine)', 'Rowing Machine', 'Cycling', 'Bicycling, Stationary', 'Walking', 'Elliptical Trainer', 'Trail Running/Walking', 'Swimming']) {
      expect(isDistanceName(n), n).toBe(true)
    }
    for (const n of ['Walking Lunge', 'Bicycle Crunch', "Farmer's Walk", 'Monster Walk', 'Bent Over Barbell Row', 'Seated Cable Rowing', 'Air Bike', "Runner's Stretch", 'Upright Row', 'Bench Press']) {
      expect(isDistanceName(n), n).toBe(false)
    }
  })

  it('rutine eklenen koşu: tek set, 5 km / 30 dk, ilerleme kapalı', () => {
    expect(defaultExCfg({ id: 'run', name: 'Running, Treadmill', equipment: 'machine' })).toMatchObject({
      sets: 1,
      reps: 1800,
      meters: 5000,
      distance: true,
      prog: 'off',
      weight: 0,
    })
    expect(defaultExCfg({ id: 'bench', name: 'Bench Press', equipment: 'barbell' }).distance).toBeUndefined()
  })
})

describe('mesafe setleri: hesaplardan hariç', () => {
  const history = [wk('w1', '2026-10-01', [run([[5000, 1650]]), bench]), wk('w2', '2026-10-03', [run([[3000, 900]])])]

  it('hacme girmez; yalnız mesafe varsa hacim satırı yok', () => {
    expect(workoutVolume(history[0])).toBe(480)
    expect(hasVolume(history[1])).toBe(false)
    expect(hasVolume(history[0])).toBe(true)
  })

  it('geçmiş noktası 1RM 0, en uzun set, toplam mesafe ve en iyi tempo taşır', () => {
    const [a, b] = exerciseHistory(history, 'run')
    expect(a).toMatchObject({ e1rm: 0, topW: 0, distance: true, topM: 5000, totalM: 5000, pace: 330 })
    expect(b).toMatchObject({ topM: 3000, pace: 300 })
  })

  it('PR: daha uzun set ya da daha iyi tempo; ikisi de değilse değil', () => {
    expect(isPR([], run([[1000, 300]]))).toBe(true)
    expect(isPR(history, run([[6000, 2400]]))).toBe(true)
    expect(isPR(history, run([[2000, 560]]))).toBe(true)
    expect(isPR(history, run([[2000, 700]]))).toBe(false)
    // 500 m altı kısa set tempoya sayılmaz.
    expect(isPR(history, run([[400, 60]]))).toBe(false)
  })

  it('plato ve deload mesafe seanslarını görmez', () => {
    const many = Array.from({ length: 8 }, (_, i) => wk(`p${i}`, `2026-09-${String(10 + i).padStart(2, '0')}`, [run([[5000, 1800]])]))
    expect(detectPlateau(many, 'run')).toBeUndefined()
    expect(detectDeload(many, Date.parse('2026-09-20T12:00'))).toBeUndefined()
  })

  it('RIR istenmez ve kapsamaya girmez; sıfır ağırlık uyarısı çıkmaz', () => {
    const w = wk('w', '2026-10-05', [run([[5000, 1650]])])
    expect(missingRirCount(w)).toBe(0)
    expect(rirCoverage(w).total).toBe(0)
    expect(isZeroWeightSet({ distance: true }, { w: 0, done: true }, 'machine')).toBe(false)
  })

  it('özet ve rekorlar: toplam, en uzun, en iyi tempo; mesafe kaydı kendi satırında', () => {
    const s = exerciseSummary(history, 'run')
    expect(s.best).toBeUndefined()
    expect(s.distance).toEqual({
      totalM: 8000,
      totalSec: 2550,
      longest: { d: '2026-10-01', m: 5000, sec: 1650 },
      bestPace: { d: '2026-10-03', m: 3000, sec: 900, pace: 300 },
    })
    const rec = personalRecords(history).find((r) => r.exId === 'run')!
    expect(rec).toMatchObject({ distance: true, timed: false, sessions: 2, d: '2026-10-03' })
    expect(rec.e1rm).toBeUndefined()
    expect(rec.top.set.m).toBe(5000)
    expect(rec.pace?.value).toBe(300)
  })
})

describe('mesafe seansı kurulumu ve geçişler', () => {
  it('rutinden: hedef mesafe + süre, ısınma/drop/tek taraf/ağırlık yok', () => {
    const w = buildWorkout(
      { id: 'r', name: 'Kardiyo', ex: [{ exId: 'run', sets: 2, reps: 1500, repsMax: 1500, weight: 50, prog: 'double', inc: 2.5, distance: true, meters: 4000, warmups: 2, drops: 1, side: true, bw: true }] },
      [],
      Date.parse('2026-10-05T08:00'),
    )
    expect(w.entries[0]).toEqual({
      exId: 'run',
      distance: true,
      sets: [
        { w: 0, r: 1500, m: 4000, done: false },
        { w: 0, r: 1500, m: 4000, done: false },
      ],
    })
    expect(nextPrescription({ exId: 'run', sets: 1, reps: 1500, repsMax: 1500, weight: 0, prog: 'off', inc: 0, distance: true, meters: 4000 })).toEqual({
      w: 0,
      r: 1500,
      m: 4000,
      reason: 'plan',
    })
  })

  it('son mesafe kurulumu yalnız mesafe kaydından gelir', () => {
    const h = [wk('w1', '2026-10-01', [run([[5000, 1650]])])]
    expect(lastSetup(h, 'run', false, false, true)).toEqual({ sets: 1, w: 0, r: 1650, m: 5000 })
    expect(lastSetup(h, 'run', false)).toBeNull()
  })

  it('mesafe ↔ tekrarlı geçiş: yapılmışsa dokunmaz', () => {
    const plain: WorkoutEntry = { exId: 'run', sets: [{ w: 20, r: 5, done: false, warmup: true }, { w: 60, r: 8, done: false }, { w: 60, r: 8, done: false }] }
    const on = toggleDistanceEntry(plain)
    expect(on).toEqual({
      exId: 'run',
      distance: true,
      sets: [
        { w: 0, r: 1800, m: 5000, done: false },
        { w: 0, r: 1800, m: 5000, done: false },
      ],
    })
    const off = toggleDistanceEntry(on)
    expect(off.distance).toBeUndefined()
    expect(off.sets.every((s) => s.m === undefined && s.r === 8)).toBe(true)
    const done = { ...on, sets: [{ ...on.sets[0], done: true }] }
    expect(toggleDistanceEntry(done)).toBe(done)
  })

  it('değiştir: mesafe egzersizine geçerken mesafe setleri kurulur', () => {
    const h = [wk('w1', '2026-10-01', [{ ...run([[2000, 480]]), exId: 'row' }])]
    const swapped = swapEntry(bench.sets[0].done ? { ...bench, sets: [{ w: 60, r: 8, done: false }] } : bench, 'row', false, h, { distance: true })
    expect(swapped).toEqual({ exId: 'row', distance: true, sets: [{ w: 0, r: 480, m: 2000, done: false }] })
  })

  it('kayıtlı antrenmanı düzenleme: mesafe ve süre sınırlara çekilir', () => {
    const w = wk('w', '2026-10-01', [run([[5000, 1650]])])
    const e = editSet(editSet(w, 0, 0, { m: 5_000_000.4 }), 0, 0, { r: 99_999 })
    expect(e.entries[0].sets[0]).toEqual({ w: 0, r: 86_400, m: 1_000_000, done: true })
  })
})

describe('mesafe setleri: yedek, sanitize ve birleştirme', () => {
  function withDistance(): State {
    const s = defaultState()
    s.routines = [{ id: 'rk', name: 'Kardiyo', ex: [{ exId: 'run', sets: 1, reps: 1800, weight: 0, prog: 'off', inc: 0, repsMax: 1800, distance: true, meters: 5000 }] }]
    s.workouts = [wk('wd', '2026-10-03', [run([[5020, 1785], [1000, 290]]), bench])]
    return s
  }

  it('geçerli mesafe verisi bayt bayt aynı kalır ve yedek gidiş-dönüşü korunur', () => {
    const s = withDistance()
    const { state, report } = migrateWithReport(JSON.parse(JSON.stringify(s)))
    expect(JSON.stringify(state)).toBe(JSON.stringify(s))
    expect(repairedTotal(report)).toBe(0)
    expect(importBackupWithReport(exportBackup(s)).state).toEqual(s)
  })

  it('mesafeyi ve süreyi sınıra/tam sayıya çeker; mesafe olmayan setteki m atılır', () => {
    const s = JSON.parse(JSON.stringify(withDistance()))
    s.workouts[0].entries[0].sets[0].m = 2_000_000
    s.workouts[0].entries[0].sets[1].r = 100_000.7
    s.workouts[0].entries[1].sets[0].m = 300
    const { state, report } = migrateWithReport(s)
    expect(state.workouts[0].entries[0].sets[0].m).toBe(1_000_000)
    expect(state.workouts[0].entries[0].sets[1].r).toBe(86_400)
    expect(state.workouts[0].entries[1].sets[0]).toEqual({ w: 60, r: 8, done: true })
    expect(report.repaired.entry).toBe(2)
    expect(droppedTotal(report)).toBe(0)
  })

  it('mesafe ve süreli birlikteyse süreli atılır (süre 3600e kırpılmaz); negatif mesafe onarılır', () => {
    const s = JSON.parse(JSON.stringify(withDistance()))
    s.workouts[0].entries[0].timed = true
    s.workouts[0].entries[0].sets[1].m = -5
    s.routines[0].ex[0].timed = true
    s.routines[0].ex[0].reps = 7200
    const { state } = migrateWithReport(s)
    const e = state.workouts[0].entries[0]
    expect(e.timed).toBeUndefined()
    expect(e.sets[0].r).toBe(1785)
    expect(e.sets[1].m).toBeUndefined()
    expect(state.routines[0].ex[0]).toMatchObject({ distance: true, reps: 7200 })
    expect(state.routines[0].ex[0].timed).toBeUndefined()
  })

  it('rutinde mesafe olmayan egzersizdeki meters atılır', () => {
    const s = JSON.parse(JSON.stringify(withDistance()))
    s.routines[0].ex.push({ exId: 'b', sets: 3, reps: 8, weight: 60, prog: 'off', inc: 0, repsMax: 8, meters: 100 })
    const { state, report } = migrateWithReport(s)
    expect(state.routines[0].ex[1].meters).toBeUndefined()
    expect(report.repaired.routineEx).toBe(1)
  })

  it('yedek birleştirme mesafe setlerini taşır; aynı içerik kopya sayılır', () => {
    const local = defaultState()
    const incoming = withDistance()
    const { state, report } = mergeState(local, incoming)
    expect(state.workouts[0].entries[0]).toEqual(incoming.workouts[0].entries[0])
    expect(state.routines[0].ex[0]).toMatchObject({ distance: true, meters: 5000, reps: 1800 })
    expect(mergeState(state, { ...incoming, workouts: [{ ...incoming.workouts[0], id: 'kopya' }] }).report.contentDuplicates).toBe(1)
    expect(report.workouts.added).toBe(1)
  })

  it('paylaşılan rutin: mesafe hedefi korunur, ağırlık/ilerleme/süreli düşer', () => {
    const r = sanitizeRoutine({
      id: 'x',
      name: 'Koşu',
      ex: [{ exId: 'run', sets: 2, reps: 99_999, distance: true, meters: 10_000.6, weight: 80, prog: 'double', timed: true, warmups: 2 }],
    })
    expect(r?.ex[0]).toEqual({ exId: 'run', sets: 2, reps: 86_400, weight: 0, prog: 'off', inc: 0, repsMax: 86_400, distance: true, meters: 10_001 })
  })
})
