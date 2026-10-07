import { describe, expect, it } from 'vitest'
import type { ExCfg, SetEntry, WorkoutEntry } from '../store/schema.ts'
import { nextPrescription } from './progression.ts'

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
