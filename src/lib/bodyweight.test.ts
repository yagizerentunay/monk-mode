import { describe, expect, it } from 'vitest'
import type { BodyweightEntry } from '../store/schema.ts'
import { averageOver, dayIndex, formatRate, goalStatus, weeklyRate } from './bodyweight.ts'

const bw = (d: string, w: number): BodyweightEntry => ({ d, w })
const END = dayIndex('2026-10-28')

/** Her gün +kgPerDay artan sentetik tartılar: END dahil geriye `count` gün. */
function series(count: number, start: number, kgPerDay: number): BodyweightEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const day = END - (count - 1 - i)
    const date = new Date(day * 24 * 60 * 60 * 1000)
    const d = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    return bw(d, start + i * kgPerDay)
  })
}

describe('gün numarası', () => {
  it('ardışık günleri 1 farkla verir, ay ve yıl sınırını geçer', () => {
    expect(dayIndex('2026-03-01') - dayIndex('2026-02-28')).toBe(1)
    expect(dayIndex('2026-01-01') - dayIndex('2025-12-31')).toBe(1)
    expect(dayIndex('2026-10-25') - dayIndex('2026-10-24')).toBe(1) // yaz saati değişimi haftası
  })
})

describe('ortalama', () => {
  it('pencere içindeki tartıların ortalamasını verir, dışarıdakini ve gelecekteki tartıyı saymaz', () => {
    const e = [bw('2026-10-20', 99), bw('2026-10-22', 80), bw('2026-10-28', 82), bw('2026-10-30', 120)]
    expect(averageOver(e, END, 7)).toBe(81)
    expect(averageOver(e, END, 3)).toBe(82)
  })

  it('pencerede kayıt yoksa null verir', () => {
    expect(averageOver([bw('2026-09-01', 80)], END, 7)).toBeNull()
    expect(averageOver([], END, 7)).toBeNull()
  })
})

describe('haftalık değişim hızı', () => {
  it('düzenli artışta gerçek hızı verir', () => {
    // günde 0,05 kg = haftada 0,35 kg
    expect(weeklyRate(series(28, 70, 0.05), END)!).toBeCloseTo(0.35, 5)
  })

  it('azalışta negatif verir', () => {
    expect(weeklyRate(series(28, 80, -0.1), END)!).toBeCloseTo(-0.7, 5)
  })

  it('günlük dalgalanmaya rağmen eğimi bulur (iki uca bakmaz)', () => {
    const noisy = series(28, 70, 0.05).map((e, i) => ({ ...e, w: e.w + (i % 2 === 0 ? 0.8 : -0.8) }))
    const rate = weeklyRate(noisy, END)!
    expect(rate).toBeGreaterThan(0.2)
    expect(rate).toBeLessThan(0.5)
  })

  it('az veride ya da kısa aralıkta güvenilir hız vermez', () => {
    expect(weeklyRate([bw('2026-10-27', 80), bw('2026-10-28', 81)], END)).toBeNull()
    expect(weeklyRate(series(5, 70, 0.05), END)).toBeNull() // 5 gün, 3+ nokta ama 10 günden kısa
    expect(weeklyRate([], END)).toBeNull()
  })

  it('pencere dışındaki eski tartıları saymaz', () => {
    const old = series(60, 60, 1) // hızlı eski artış
    const recent = series(28, 70, 0)
    const only = [...old.slice(0, 20), ...recent]
    expect(weeklyRate(only, END)!).toBeCloseTo(0, 5)
  })

  it('aynı gün birden fazla noktayla bölme hatası vermez', () => {
    const same = [bw('2026-10-20', 80), bw('2026-10-20', 80.5), bw('2026-10-20', 81)]
    expect(weeklyRate(same, END)).toBeNull()
  })
})

describe('hedefe göre durum', () => {
  it('toleransın içindekini "hedefte" sayar, sınırda da', () => {
    expect(goalStatus(0.25, 0.25)).toBe('on')
    expect(goalStatus(0.1, 0.25)).toBe('on')
    expect(goalStatus(0.4, 0.25)).toBe('on')
  })

  it('daha yavaşı altında, daha hızlıyı üstünde sayar', () => {
    expect(goalStatus(0, 0.5)).toBe('below')
    expect(goalStatus(0.9, 0.5)).toBe('above')
    expect(goalStatus(-0.6, -0.25)).toBe('below')
  })

  it('bakım hedefi (0) için de çalışır', () => {
    expect(goalStatus(0.05, 0)).toBe('on')
    expect(goalStatus(0.3, 0)).toBe('above')
  })
})

describe('hız metni', () => {
  it('işaretli, virgüllü ve birimli yazar', () => {
    expect(formatRate(0.25, 'kg')).toBe('+0,25 kg/hf')
    expect(formatRate(-0.5, 'kg')).toBe('−0,5 kg/hf')
    expect(formatRate(0, 'kg')).toBe('0 kg/hf')
    expect(formatRate(0.4536, 'lb')).toBe('+1 lb/hf')
  })
})
