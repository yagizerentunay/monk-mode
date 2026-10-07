import { describe, expect, it } from 'vitest'
import { brzycki, epley, estimate1RM } from './onerm.ts'

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
})
