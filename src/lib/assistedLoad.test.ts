import { describe, expect, it } from 'vitest'
import { dropChain, dropSet, lighterLoad, retargetWarmups, warmupSet, warmupSets } from './intensity.ts'

// 80 kg vücut ağırlığı, −20 kg asist: toplam 60 kg.
const BW = 80

describe('asistli (negatif ek yük) egzersizde ısınma ve dropset', () => {
  it('hafifletmek asisti artırır: oran toplam yüke uygulanır', () => {
    // %40 ısınma: toplam 24 → asist 56 → 55 (2,5 adım) → toplam 25
    expect(lighterLoad(-20, 0.4, BW)).toBe(-55)
    // %80 drop: toplam 48 → asist 32 → 32,5
    expect(lighterLoad(-20, 0.8, BW)).toBe(-32.5)
  })

  it('ısınma rampası çalışma setinden hafif ve giderek ağırlaşır', () => {
    const totals = warmupSets(-20, 4, BW).map((s) => BW + s.w)
    for (const t of totals) expect(t).toBeLessThan(60)
    expect([...totals].sort((a, b) => a - b)).toEqual(totals)
  })

  it('dropset zinciri her halkada daha fazla asist verir, asist vücut ağırlığını aşmaz', () => {
    const chain = dropChain({ w: -20, r: 8, done: true }, 3, BW).map((s) => s.w)
    expect(chain[0]).toBeLessThan(-20)
    expect(chain[1]).toBeLessThan(chain[0])
    expect(chain[2]).toBeLessThan(chain[1])
    expect(lighterLoad(-79, 0.1, BW)).toBe(-BW)
  })

  it('vücut ağırlığı bilinmiyorsa asist aynı kalır (0 olup çalışma setinden ağırlaşmaz)', () => {
    expect(warmupSet(-20, 0).w).toBe(-20)
    expect(dropSet({ w: -20, r: 8, done: false }).w).toBe(-20)
  })

  it('ek yük 0 ya da pozitifse davranış değişmez', () => {
    expect(warmupSet(20, 0, BW).w).toBe(8)
    expect(warmupSet(0, 0, BW).w).toBe(0)
    expect(dropSet({ w: 20, r: 8, done: false }, BW).w).toBe(16)
  })

  it('çalışma asisti değişince otomatik ısınmalar yeni rampaya çekilir', () => {
    const sets = [...warmupSets(-20, 2, BW), { w: -20, r: 8, done: false }]
    const next = retargetWarmups(sets, -20, -10, BW)
    expect(next.slice(0, 2).map((s) => s.w)).toEqual(warmupSets(-10, 2, BW).map((s) => s.w))
  })
})
