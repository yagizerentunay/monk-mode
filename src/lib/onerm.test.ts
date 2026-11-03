import { describe, expect, it } from 'vitest'
import { brzycki, epley, estimate1RM, MAX_RIR_CREDIT } from './onerm.ts'

describe('1RM tahmini', () => {
  it('tek tekrarda ağırlığın kendisini verir', () => {
    expect(epley(100, 1)).toBe(100)
    expect(brzycki(100, 1)).toBe(100)
  })

  it('Epley: 100 kg x 5', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 2)
  })

  it('Brzycki: 100 kg x 5', () => {
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 2)
  })

  it('geçersiz girdide 0 döner', () => {
    expect(epley(0, 5)).toBe(0)
    expect(epley(100, 0)).toBe(0)
    expect(brzycki(-5, 5)).toBe(0)
  })

  it('12 tekrar üstünü tavana sabitler', () => {
    expect(epley(50, 20)).toBe(epley(50, 12))
  })

  it('varsayılan Epley', () => {
    expect(estimate1RM(80, 8)).toBe(epley(80, 8))
  })

  it('RIR girilmişse tükenişe kadar yapılabilecek tekrarla hesaplar', () => {
    expect(estimate1RM(100, 5, 2)).toBe(epley(100, 7))
    expect(estimate1RM(100, 5, 0)).toBe(epley(100, 5))
    expect(estimate1RM(100, 5, 3)).toBeGreaterThan(estimate1RM(100, 5, 0))
  })

  it('RIR yoksa ya da geçersizse eski hesapla aynıdır', () => {
    expect(estimate1RM(100, 5, undefined)).toBe(epley(100, 5))
    expect(estimate1RM(100, 5, Number.NaN)).toBe(epley(100, 5))
    expect(estimate1RM(100, 5, -2)).toBe(epley(100, 5))
  })

  it('RIR en çok MAX_RIR_CREDIT tekrar sayar ve toplam yine 12 ile sınırlıdır', () => {
    expect(estimate1RM(100, 5, 6)).toBe(epley(100, 5 + MAX_RIR_CREDIT))
    expect(estimate1RM(60, 11, 3)).toBe(epley(60, 12))
  })

  it('tek tekrar RIR ile ağırlığın üstünde tahmin eder; tekrar yoksa 0 kalır', () => {
    expect(estimate1RM(100, 1, 0)).toBe(100)
    expect(estimate1RM(100, 1, 2)).toBe(epley(100, 3))
    expect(estimate1RM(100, 0, 3)).toBe(0)
  })
})
