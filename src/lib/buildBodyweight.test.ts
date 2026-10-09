import { describe, expect, it } from 'vitest'
import type { ExCfg, Routine, Workout, WorkoutEntry } from '../store/schema.ts'
import { draftForDate } from './backdate.ts'
import { buildWorkout } from './workout.ts'

const NOW = new Date(2026, 9, 8, 12).getTime() // 2026-10-08, yerel öğle
const BW_LOG = [
  { d: '2026-09-01', w: 70 },
  { d: '2026-10-01', w: 67 },
  { d: '2026-10-20', w: 65 },
]

const cfg = (extra: Partial<ExCfg> = {}): ExCfg => ({
  exId: 'pullup',
  sets: 3,
  reps: 5,
  weight: 0,
  prog: 'linear',
  inc: 2.5,
  repsMax: 8,
  ...extra,
})
const routine = (...ex: ExCfg[]): Routine => ({ id: 'r1', name: 'Pull', ex })

const entry = (extra: Partial<WorkoutEntry>, w: number, r = 5, sets = 3): WorkoutEntry => ({
  exId: 'pullup',
  sets: Array.from({ length: sets }, () => ({ w, r, done: true })),
  ...extra,
})
const wk = (d: string, e: WorkoutEntry): Workout => ({ id: d, d, start: Date.parse(d), name: 'Pull', entries: [e] })

describe('buildWorkout: vücut ağırlığı egzersizi', () => {
  it('bw işaretler ve seans gününden önceki en son vücut ağırlığını kopyalar', () => {
    const w = buildWorkout(routine(cfg({ bw: true })), [], NOW, BW_LOG)
    expect(w.entries[0]).toMatchObject({ bw: true, bwKg: 67 })
  })

  it('vücut ağırlığı kaydı yoksa bw gelir, bwKg tanımsız kalır', () => {
    const w = buildWorkout(routine(cfg({ bw: true })), [], NOW, [])
    expect(w.entries[0].bw).toBe(true)
    expect(w.entries[0]).not.toHaveProperty('bwKg')
    // Parametre hiç verilmese de (eski çağrı) aynı.
    expect(buildWorkout(routine(cfg({ bw: true })), [], NOW).entries[0]).not.toHaveProperty('bwKg')
  })

  it('seans gününden sonraki kayıt kullanılmaz', () => {
    const w = buildWorkout(routine(cfg({ bw: true })), [], NOW, [{ d: '2026-10-09', w: 50 }])
    expect(w.entries[0]).not.toHaveProperty('bwKg')
  })

  it('bw olmayan egzersize bw ve bwKg yazmaz', () => {
    const w = buildWorkout(routine(cfg()), [], NOW, BW_LOG)
    expect(w.entries[0]).not.toHaveProperty('bw')
    expect(w.entries[0]).not.toHaveProperty('bwKg')
  })

  it('geçmişi yokken plan ağırlığını (ek yük) kullanır', () => {
    const w = buildWorkout(routine(cfg({ bw: true, weight: 5 })), [], NOW, BW_LOG)
    expect(w.entries[0].sets.map((s) => s.w)).toEqual([5, 5, 5])
  })

  it('ilerleme ek yük üzerinden çalışır', () => {
    const history = [wk('2026-10-01', entry({ bw: true, bwKg: 68 }, 10))]
    const w = buildWorkout(routine(cfg({ bw: true })), history, NOW, BW_LOG)
    expect(w.entries[0].sets[0]).toEqual({ w: 12.5, r: 5, done: false })
  })

  it('asist azaltılarak ilerler (−20 → −17,5)', () => {
    const history = [wk('2026-10-01', entry({ bw: true, bwKg: 68 }, -20))]
    const w = buildWorkout(routine(cfg({ bw: true, weight: -20 })), history, NOW, BW_LOG)
    expect(w.entries[0].sets[0].w).toBe(-17.5)
  })

  it('eski mutlak yüklü kaydın ağırlığını ön doldurmada KULLANMAZ (67 kg ek yük olmaz)', () => {
    const history = [wk('2026-10-01', entry({}, 67, 8))]
    const w = buildWorkout(routine(cfg({ bw: true, weight: 0, reps: 5 })), history, NOW, BW_LOG)
    expect(w.entries[0].sets.map((s) => [s.w, s.r])).toEqual([[0, 5], [0, 5], [0, 5]])
  })

  it('eski kayıt çift ilerlemede de yok sayılır, cfg.weight / cfg.reps ile başlanır', () => {
    const history = [wk('2026-10-01', entry({}, 67, 12))]
    const c = cfg({ bw: true, prog: 'double', weight: 2.5, reps: 6, repsMax: 10 })
    const w = buildWorkout(routine(c), history, NOW, BW_LOG)
    expect(w.entries[0].sets[0]).toEqual({ w: 2.5, r: 6, done: false })
  })

  it('eski kayıt yok sayılınca ısınmalar da plan ağırlığından kurulur', () => {
    const history = [wk('2026-10-01', entry({}, 67, 8))]
    const w = buildWorkout(routine(cfg({ bw: true, weight: 0, warmups: 2 })), history, NOW, BW_LOG)
    expect(w.entries[0].sets.filter((s) => s.warmup).every((s) => s.w === 0)).toBe(true)
  })

  it('bw bayrağı kapalıyken son kayıt ek yükle girilmişse onu da mutlak yük diye kullanmaz', () => {
    const history = [wk('2026-10-01', entry({ bw: true, bwKg: 68 }, 10))]
    const w = buildWorkout(routine(cfg({ weight: 20 })), history, NOW, BW_LOG)
    expect(w.entries[0].sets[0].w).toBe(20)
  })

  it('bw bayrağı kapalıyken mutlak kayıt eskisi gibi ilerler (davranış korunur)', () => {
    const history = [wk('2026-10-01', entry({}, 60))]
    const w = buildWorkout(routine(cfg({ weight: 20 })), history, NOW, BW_LOG)
    expect(w.entries[0].sets[0].w).toBe(62.5)
  })

  it('aynı seansta bw ve normal egzersiz karışık kurulur', () => {
    const w = buildWorkout(routine(cfg({ bw: true }), cfg({ exId: 'row', weight: 40 })), [], NOW, BW_LOG)
    expect(w.entries[0].bw).toBe(true)
    expect(w.entries[1]).not.toHaveProperty('bw')
    expect(w.entries[1].sets[0].w).toBe(40)
  })
})

describe('draftForDate: vücut ağırlığı', () => {
  it('o güne kadarki vücut ağırlığını kopyalar', () => {
    const d = draftForDate(routine(cfg({ bw: true })), [], '2026-09-15', BW_LOG)
    expect(d.entries[0]).toMatchObject({ bw: true, bwKg: 70 })
    const later = draftForDate(routine(cfg({ bw: true })), [], '2026-10-05', BW_LOG)
    expect(later.entries[0].bwKg).toBe(67)
  })

  it('eski mutlak kaydı ön doldurmaya taşımaz', () => {
    const history = [wk('2026-09-01', entry({}, 67))]
    const d = draftForDate(routine(cfg({ bw: true })), history, '2026-09-15', BW_LOG)
    expect(d.entries[0].sets[0].w).toBe(0)
  })
})
