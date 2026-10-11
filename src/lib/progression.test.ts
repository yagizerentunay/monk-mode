import { describe, expect, it } from 'vitest'
import type { ExCfg, SetEntry, WorkoutEntry } from '../store/schema.ts'
import { nextPrescription as prescribe, type PrescribeOptions } from './progression.ts'

const cfg = (over: Partial<ExCfg> = {}): ExCfg => ({
  exId: 'squat',
  sets: 3,
  reps: 5,
  weight: 60,
  prog: 'linear',
  inc: 2.5,
  repsMax: 8,
  ...over,
})

/** Önceki testler tek seanslık (hızlı) kuralı sınar; temkinli kural aşağıda ayrıca. */
const nextPrescription = (c: ExCfg, last?: WorkoutEntry, opts: PrescribeOptions = { rule: 'fast' }) =>
  prescribe(c, last, opts)

const set = (w: number, r: number, done = true): SetEntry => ({ w, r, done })
const entry = (...sets: SetEntry[]): WorkoutEntry => ({ exId: 'squat', sets })

describe('nextPrescription', () => {
  it('geçmiş yokken planı verir', () => {
    expect(nextPrescription(cfg())).toEqual({ w: 60, r: 5, reason: 'plan' })
  })

  it('progression kapalıyken planı verir', () => {
    const last = entry(set(100, 5), set(100, 5), set(100, 5))
    expect(nextPrescription(cfg({ prog: 'off' }), last).reason).toBe('plan')
  })

  it('linear: tüm tekrarlar tamamsa ağırlığı artırır', () => {
    const last = entry(set(60, 5), set(60, 5), set(60, 5))
    expect(nextPrescription(cfg(), last)).toEqual({ w: 62.5, r: 5, reason: 'increase' })
  })

  it('linear: tekrar tutmadıysa ağırlığı korur', () => {
    const last = entry(set(60, 5), set(60, 4), set(60, 3))
    expect(nextPrescription(cfg(), last)).toEqual({ w: 60, r: 5, reason: 'repeat' })
  })

  it('linear: eksik set sayısı artışı engeller', () => {
    const last = entry(set(60, 5), set(60, 5))
    expect(nextPrescription(cfg(), last).reason).toBe('repeat')
  })

  it('linear: tamamlanmamış set artışı engeller', () => {
    const last = entry(set(60, 5), set(60, 5), set(60, 5, false))
    expect(nextPrescription(cfg(), last).reason).toBe('repeat')
  })

  it('ısınma setlerini saymaz', () => {
    const last = entry({ ...set(20, 5), warmup: true }, set(60, 5), set(60, 5), set(60, 5))
    expect(nextPrescription(cfg(), last).w).toBe(62.5)
  })

  it('dropsetleri yok sayar: hafif, az tekrarlı drop ilerlemeyi engellemez ve ağırlığı düşürmez', () => {
    const last = entry(set(60, 5), set(60, 5), set(60, 5), { w: 47.5, r: 3, done: true, drop: true })
    expect(nextPrescription(cfg(), last)).toEqual({ w: 62.5, r: 5, reason: 'increase' })
  })

  it('ısınma ve dropsetler çalışma seti sayısına eklenmez', () => {
    // 3 set hedefi, yalnız 2 asıl set + 1 drop yapılmış: eksik sayılmalı
    const last = entry(set(60, 5), set(60, 5), { w: 47.5, r: 5, done: true, drop: true })
    expect(nextPrescription(cfg(), last).reason).toBe('repeat')
  })

  it('double: üst sınıra ulaşılınca ağırlık artar ve tekrar sıfırlanır', () => {
    const last = entry(set(60, 8), set(60, 8), set(60, 8))
    expect(nextPrescription(cfg({ prog: 'double' }), last)).toEqual({
      w: 62.5,
      r: 5,
      reason: 'increase',
    })
  })

  it('double: aralık içindeyse en zayıf sete göre bir tekrar ekler', () => {
    const last = entry(set(60, 6), set(60, 5), set(60, 5))
    expect(nextPrescription(cfg({ prog: 'double' }), last)).toEqual({
      w: 60,
      r: 6,
      reason: 'add-rep',
    })
  })
})

describe('nextPrescription: temkinli kural (varsayılan)', () => {
  const rset = (w: number, r: number, rir?: number): SetEntry => ({ w, r, done: true, ...(rir === undefined ? {} : { rir }) })
  const three = (w: number, r: number, rir?: number) => entry(rset(w, r, rir), rset(w, r, rir), rset(w, r, rir))
  const good = three(60, 5, 2)

  it('tek başarılı seans yetmez: ağırlığı korur ve onay ister', () => {
    expect(nextPrescription(cfg(), good, {})).toEqual({ w: 60, r: 5, reason: 'confirm' })
    expect(nextPrescription(cfg(), good, { prev: three(60, 4, 2) }).reason).toBe('confirm')
  })

  it('kural verilmezse temkinli sayılır; iki başarılı seanstan sonra artırır', () => {
    expect(nextPrescription(cfg(), good, { prev: three(60, 5, 3) })).toEqual({ w: 62.5, r: 5, reason: 'increase' })
    expect(nextPrescription(cfg(), good, { prev: good, rule: 'cautious' }).reason).toBe('increase')
  })

  it('RIR 2den düşük set artışı engeller (son ya da önceki seansta)', () => {
    const low = entry(rset(60, 5, 2), rset(60, 5, 1), rset(60, 5, 2))
    expect(nextPrescription(cfg(), low, { prev: good }).reason).toBe('repeat')
    expect(nextPrescription(cfg(), good, { prev: low }).reason).toBe('confirm')
  })

  it('RIR girilmemiş seans başarı sayılmaz: need-rir (son ya da önceki seans)', () => {
    const noRir = three(60, 5)
    expect(nextPrescription(cfg(), noRir, { prev: good })).toEqual({ w: 60, r: 5, reason: 'need-rir' })
    expect(nextPrescription(cfg(), good, { prev: noRir }).reason).toBe('need-rir')
    expect(nextPrescription(cfg(), entry(rset(60, 5, 2), rset(60, 5), rset(60, 5, 2)), { prev: good }).reason).toBe('need-rir')
  })

  it('iki seans farklı yükteyse ya da farklı set sayısındaysa artmaz', () => {
    expect(nextPrescription(cfg(), good, { prev: three(57.5, 5, 2) }).reason).toBe('confirm')
    const twoSets = entry(rset(60, 5, 2), rset(60, 5, 2))
    expect(nextPrescription(cfg({ sets: 2 }), twoSets, { prev: good }).reason).toBe('confirm')
  })

  it('eksik set sayısı ya da tamamlanmamış set başarı sayılmaz', () => {
    expect(nextPrescription(cfg(), entry(rset(60, 5, 2), rset(60, 5, 2)), { prev: good }).reason).toBe('repeat')
    expect(nextPrescription(cfg(), entry(rset(60, 5, 2), rset(60, 5, 2), set(60, 5, false)), { prev: good }).reason).toBe('repeat')
  })

  it('ısınma ve dropsetler RIR/tekrar koşuluna girmez', () => {
    const withExtras = entry(
      { ...set(20, 5), warmup: true },
      rset(60, 5, 2),
      rset(60, 5, 2),
      rset(60, 5, 2),
      { w: 47.5, r: 3, done: true, drop: true },
    )
    expect(nextPrescription(cfg(), withExtras, { prev: withExtras }).reason).toBe('increase')
  })

  it('hızlı kural tek seansla artırır ve prev/RIR aramaz', () => {
    expect(nextPrescription(cfg(), three(60, 5), { rule: 'fast' })).toEqual({ w: 62.5, r: 5, reason: 'increase' })
    expect(nextPrescription(cfg(), three(60, 5, 0), { rule: 'fast', prev: three(50, 5) }).reason).toBe('increase')
  })

  it('double: tekrar ekleme eskisi gibi (RIR aranmaz), üst sınırda onay beklenir', () => {
    const d = cfg({ prog: 'double' })
    expect(nextPrescription(d, entry(rset(60, 6), rset(60, 5), rset(60, 5)), {})).toEqual({ w: 60, r: 6, reason: 'add-rep' })
    expect(nextPrescription(d, three(60, 8, 2), {})).toEqual({ w: 60, r: 8, reason: 'confirm' })
    expect(nextPrescription(d, three(60, 8, 2), { prev: three(60, 8, 3) })).toEqual({ w: 62.5, r: 5, reason: 'increase' })
    expect(nextPrescription(d, three(60, 8, 1), { prev: three(60, 8, 3) })).toEqual({ w: 60, r: 8, reason: 'repeat' })
  })
})
