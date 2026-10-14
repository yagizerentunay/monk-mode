import { describe, expect, it } from 'vitest'
import type { ExCfg, SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { detectDeload } from './deload.ts'
import { editSet } from './editWorkout.ts'
import { exerciseSummary } from './exerciseStats.ts'
import { comparableLast, formatTimedLoad } from './load.ts'
import { muscleSets } from './muscles.ts'
import { detectPlateau } from './plateau.ts'
import { nextPrescription } from './progression.ts'
import { formatSet } from './sets.ts'
import { swapEntry } from './swap.ts'
import { weeklyTotals } from './weeklyTrend.ts'
import {
  buildWorkout,
  doneSetCount,
  exerciseHistory,
  isPR,
  lastSetup,
  lastTwoEntriesFor,
  workoutVolume,
} from './workout.ts'

const hold = (r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w: 0, r, done: true, ...extra })
const timedEntry = (sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
  exId: 'plank',
  timed: true,
  sets,
  ...extra,
})
const session = (d: string, entries: WorkoutEntry[]): Workout => ({ id: d, d, start: 0, name: 'Core', entries })

const cfg = (over: Partial<ExCfg> = {}): ExCfg => ({
  exId: 'plank',
  sets: 3,
  reps: 30,
  repsMax: 30,
  weight: 0,
  prog: 'double',
  inc: 0,
  timed: true,
  ...over,
})

describe('süreli set gösterimi', () => {
  it('süreyi "45 sn" / "1:30" yazar, ek yükü başa koyar', () => {
    expect(formatSet(hold(45), '', true)).toBe('45 sn')
    expect(formatSet(hold(90), '', true)).toBe('1:30')
    expect(formatSet(hold(45, { w: 10 }), formatTimedLoad(true, 10, 'kg'), true)).toBe('+10 kg · 45 sn')
    expect(formatSet(hold(45, { rir: 2 }), '', true)).toBe('45 sn @2')
  })

  it('tek taraflıda iki tarafı ayrı yazar; tekrarlı set eskisi gibi kalır', () => {
    const side = hold(30, { sides: { L: { r: 45, done: true }, R: { r: 40, done: true } } })
    expect(formatSet(side, '', true)).toBe('L45 sn/R40 sn')
    expect(formatSet({ w: 60, r: 8, done: true }, '60')).toBe('60×8')
  })

  it('ek yük metni: yoksa boş, vücut ağırlığında işaretli, aksi hâlde birimli', () => {
    expect(formatTimedLoad(true, 0, 'kg')).toBe('')
    expect(formatTimedLoad(true, -20, 'kg')).toBe('−20 kg')
    expect(formatTimedLoad(false, 10, 'kg')).toBe('10 kg')
  })
})

describe('süreli set hesapları', () => {
  const plank = timedEntry([hold(60), hold(60, { w: 20 })])
  const bench: WorkoutEntry = { exId: 'bench', sets: [{ w: 100, r: 5, done: true }] }

  it('hacme girmez ama çalışma seti olarak sayılır', () => {
    const w = session('2026-10-05', [plank, bench])
    expect(workoutVolume(w)).toBe(500)
    expect(doneSetCount(w)).toEqual({ done: 3, total: 3 })
  })

  it('haftalık özet: set sayılır, hacim yalnız tekrarlı egzersizden gelir', () => {
    const w = session('2026-10-05', [plank])
    const [week] = weeklyTotals([w], new Date(2026, 9, 7), 1, 1)
    expect(week).toMatchObject({ sets: 2, volume: 0, workouts: 1 })
  })

  it('kas haritasında sert set olarak sayılır', () => {
    const byId = new Map([['plank', { primaryMuscles: ['abdominals'], secondaryMuscles: ['shoulders'] }]])
    const r = muscleSets([session('2026-10-05', [plank])], byId, { from: '2026-10-01' })
    expect(r.abdominals).toBe(2)
    expect(r.shoulders).toBe(1)
  })

  it('1RM serisinde 0, en uzun tutuş topSec olarak döner', () => {
    const pts = exerciseHistory([session('2026-10-05', [plank])], 'plank')
    expect(pts).toEqual([{ d: '2026-10-05', topW: 20, e1rm: 0, timed: true, topSec: 60 }])
  })

  it('exerciseSummary 1RM yerine en uzun tutuşu verir', () => {
    const s = exerciseSummary(
      [session('2026-10-05', [plank]), session('2026-10-08', [timedEntry([hold(75, { w: 5 })])])],
      'plank',
    )
    expect(s.best).toBeUndefined()
    expect(s.bestHold).toEqual({ d: '2026-10-08', w: 5, sec: 75 })
    expect(s.last?.timed).toBe(true)
    expect(s.sessions).toBe(2)
  })
})

describe('süreli PR', () => {
  const before = [session('2026-10-01', [timedEntry([hold(40), hold(45)])])]

  it('en uzun tutuşu geçince PR, eşitse değil', () => {
    expect(isPR(before, timedEntry([hold(46)]))).toBe(true)
    expect(isPR(before, timedEntry([hold(45)]))).toBe(false)
    expect(isPR(before, timedEntry([hold(0)]))).toBe(false)
  })

  it('ilk süreli seans rekordur; tekrarlı geçmiş süreli rekora karışmaz', () => {
    expect(isPR([], timedEntry([hold(20)]))).toBe(true)
    const reps = [session('2026-10-01', [{ exId: 'plank', sets: [{ w: 0, r: 3000, done: true }] }])]
    expect(isPR(reps, timedEntry([hold(20)]))).toBe(true)
  })

  it('tekrarlı egzersizin PR mantığı süreli geçmişten etkilenmez', () => {
    const mixed = [session('2026-10-01', [timedEntry([hold(600)])])]
    expect(isPR(mixed, { exId: 'plank', sets: [{ w: 20, r: 5, done: true }] })).toBe(true)
  })
})

describe('plato ve deload süreli egzersizi yok sayar', () => {
  it('uzun süreli geçmişte plato uyarısı çıkmaz', () => {
    const ws = Array.from({ length: 8 }, (_, i) => session(`2026-09-0${i + 1}`, [timedEntry([hold(60)])]))
    expect(detectPlateau(ws, 'plank')).toBeUndefined()
  })

  it('süreli seanslar düşse bile deload önerisi çıkmaz', () => {
    const NOW = new Date(2026, 9, 11, 12).getTime()
    const day = (ago: number) => {
      const d = new Date(NOW - ago * 86_400_000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const secs = [90, 90, 90, 90, 40, 30]
    const ws = secs.map((s, i) =>
      session(day(2 + (secs.length - 1 - i) * 3), [
        // Ağırlık süreyle birlikte düşer: süreli bayrağı olmasaydı 1RM düşüşü gibi görünürdü.
        timedEntry([hold(s, { w: s })]),
        timedEntry([hold(s, { w: s })], { exId: 'side-plank' }),
      ]),
    )
    expect(detectDeload(ws, NOW)).toBeUndefined()
  })
})

describe('süreli seans kurma ve ilerleme', () => {
  const routine = { id: 'r', name: 'Core', ex: [cfg({ warmups: 2 })] }

  it('buildWorkout süreli girdi kurar: hedef saniye, ısınma yok', () => {
    const w = buildWorkout(routine, [], 1_000)
    const e = w.entries[0]
    expect(e.timed).toBe(true)
    expect(e.sets).toEqual([0, 1, 2].map(() => ({ w: 0, r: 30, done: false })))
  })

  it('tüm setler hedefe ulaşınca süre 5 sn artar, ağırlık değişmez', () => {
    const last = timedEntry([hold(30, { w: 10 }), hold(32, { w: 10 }), hold(30, { w: 10 })])
    expect(nextPrescription(cfg(), last)).toEqual({ w: 10, r: 35, reason: 'add-sec' })
  })

  it('çift ilerlemede hedef aralığın üstünde durur, aşınca +5 devam eder', () => {
    const c = cfg({ reps: 30, repsMax: 60 })
    expect(nextPrescription(c, timedEntry([hold(28), hold(28), hold(28)])).r).toBe(33)
    expect(nextPrescription(c, timedEntry([hold(58), hold(58), hold(58)])).r).toBe(60)
    expect(nextPrescription(c, timedEntry([hold(60), hold(65), hold(60)])).r).toBe(65)
  })

  it('doğrusal ilerlemede hedef reps', () => {
    const c = cfg({ prog: 'linear', reps: 30, repsMax: 60 })
    expect(nextPrescription(c, timedEntry([hold(25), hold(25), hold(25)])).r).toBe(30)
  })

  it('eksik set varsa tekrar eder; ilerleme kapalıysa plan', () => {
    const last = timedEntry([hold(40), hold(40), { w: 0, r: 40, done: false }])
    expect(nextPrescription(cfg(), last)).toMatchObject({ r: 40, reason: 'repeat' })
    expect(nextPrescription(cfg({ prog: 'off' }), timedEntry([hold(50), hold(50), hold(50)])).reason).toBe('plan')
  })

  it('RIR yokluğu süreli ilerlemeyi engellemez ve süre 3600de durur', () => {
    const last = timedEntry([hold(3600), hold(3600), hold(3600)])
    expect(nextPrescription(cfg(), last).r).toBe(3600)
  })

  it('süreli seans kurulurken yalnız süreli geçmiş kullanılır', () => {
    const history = [
      session('2026-10-01', [
        { exId: 'plank', sets: [{ w: 0, r: 20, done: true }, { w: 0, r: 20, done: true }, { w: 0, r: 20, done: true }] },
      ]),
    ]
    expect(buildWorkout(routine, history, 1_000).entries[0].sets[0].r).toBe(30)
    const timedHistory = [session('2026-10-02', [timedEntry([hold(40), hold(40), hold(40)])])]
    expect(buildWorkout(routine, timedHistory, 1_000).entries[0].sets[0].r).toBe(45)
  })

  it('comparableLast ve lastTwoEntriesFor türü ayırır', () => {
    const e = timedEntry([hold(30)])
    expect(comparableLast(e, false, true)).toBe(e)
    expect(comparableLast(e, false)).toBeUndefined()
    expect(lastTwoEntriesFor([session('2026-10-01', [e])], 'plank', false).last).toBeUndefined()
    expect(lastTwoEntriesFor([session('2026-10-01', [e])], 'plank', false, true).last).toBe(e)
  })

  it('lastSetup süreli geçmişten set sayısı ve en kısa süreyi verir', () => {
    const h = [session('2026-10-01', [timedEntry([hold(45), hold(40), hold(50)])])]
    expect(lastSetup(h, 'plank', false, true)).toEqual({ sets: 3, w: 0, r: 40 })
    expect(lastSetup(h, 'plank', false)).toBeNull()
  })
})

describe('süreli değiştirme ve düzenleme', () => {
  const todo = (extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
    exId: 'crunch',
    sets: [
      { w: 0, r: 15, done: false, warmup: true },
      { w: 0, r: 12, done: false },
      { w: 0, r: 12, done: false },
    ],
    ...extra,
  })

  it('tekrarlıdan süreliye geçince saniye hedefi gelir, ısınma düşer, bayrak konur', () => {
    const swapped = swapEntry(todo(), 'plank', false, [], { timed: true })
    expect(swapped?.timed).toBe(true)
    expect(swapped?.sets).toEqual([
      { w: 0, r: 30, done: false },
      { w: 0, r: 30, done: false },
    ])
  })

  it('süreliden tekrarlıya geçince bayrak kalkar ve tekrar hedefi 8 olur', () => {
    const swapped = swapEntry(todo({ timed: true, sets: [{ w: 0, r: 45, done: false }] }), 'crunch', false, [])
    expect(swapped?.timed).toBeUndefined()
    expect(swapped?.sets[0].r).toBe(8)
  })

  it('süreliden süreliye geçince hedef süre korunur', () => {
    const from = todo({ timed: true, sets: [{ w: 0, r: 45, done: false }] })
    expect(swapEntry(from, 'side-plank', false, [], { timed: true })?.sets[0].r).toBe(45)
  })

  it('editSet süreli girdide saniyeyi 3600e çeker, tekrarlıda çekmez', () => {
    const w = session('2026-10-05', [timedEntry([hold(30)]), { exId: 'bench', sets: [hold(5)] }])
    expect(editSet(w, 0, 0, { r: 9999 }).entries[0].sets[0].r).toBe(3600)
    expect(editSet(w, 1, 0, { r: 9999 }).entries[1].sets[0].r).toBe(9999)
  })
})
