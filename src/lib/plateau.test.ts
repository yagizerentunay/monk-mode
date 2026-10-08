import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { detectPlateau, PLATEAU_SESSIONS } from './plateau.ts'

/** Her seans tek bir çalışma seti: (ağırlık, tekrar). */
function history(sets: Array<[number, number]>, exId = 'bench'): Workout[] {
  return sets.map(([w, r], i) => ({
    id: String(i),
    d: `2026-09-${String(i + 1).padStart(2, '0')}`,
    start: 0,
    name: 'A',
    entries: [{ exId, sets: [{ w, r, done: true }] }],
  }))
}

describe('detectPlateau', () => {
  it('veri yetmiyorsa uyarı vermez', () => {
    expect(detectPlateau([], 'bench')).toBeUndefined()
    expect(detectPlateau(history([[60, 8], [60, 8], [60, 8]]), 'bench')).toBeUndefined()
  })

  it('her seans rekor kırıyorsa uyarı vermez', () => {
    expect(detectPlateau(history([[60, 8], [62.5, 8], [65, 8], [67.5, 8], [70, 8]]), 'bench')).toBeUndefined()
  })

  it('son rekordan 3 seans sonra plato döner, rekor seansı sayılmaz', () => {
    const p = detectPlateau(history([[60, 8], [65, 8], [65, 8], [65, 8], [65, 8]]), 'bench')
    expect(p?.sessions).toBe(PLATEAU_SESSIONS)
    expect(p?.best).toBeCloseTo(65 * (1 + 8 / 30))
  })

  it('rekordan bu yana 2 seans geçtiyse henüz plato değildir', () => {
    expect(detectPlateau(history([[60, 8], [65, 8], [65, 8], [65, 8]]), 'bench')).toBeUndefined()
  })

  it('seans sayısı rekordan beri arttıkça büyür', () => {
    expect(detectPlateau(history([[65, 8], [65, 8], [65, 8], [65, 8], [65, 8], [65, 8]]), 'bench')?.sessions).toBe(5)
  })

  it('yeni rekor sayacı sıfırlar', () => {
    expect(detectPlateau(history([[60, 8], [65, 8], [65, 8], [65, 8], [67.5, 8]]), 'bench')).toBeUndefined()
  })

  it('tekrar artışı da ilerlemedir', () => {
    expect(detectPlateau(history([[60, 8], [60, 8], [60, 9], [60, 10], [60, 11]]), 'bench')).toBeUndefined()
  })

  it('belirgin düşüş (deload) varsa uyarı vermez', () => {
    const wk = history([[80, 8], [80, 8], [80, 8], [80, 8], [60, 8]])
    expect(detectPlateau(wk, 'bench')).toBeUndefined()
  })

  it('en iyinin %95 üstündeki küçük gerileme platoda kalır', () => {
    expect(detectPlateau(history([[80, 8], [80, 8], [80, 8], [80, 8], [77.5, 8]]), 'bench')?.sessions).toBe(4)
  })

  it('yalnız ilgili egzersize bakar', () => {
    const wk = [...history([[60, 8], [65, 8], [65, 8], [65, 8], [65, 8]], 'bench'), ...history([[40, 8]], 'row')]
    expect(detectPlateau(wk, 'row')).toBeUndefined()
    expect(detectPlateau(wk, 'bench')).toBeDefined()
  })

  it('ısınma ve tamamlanmamış setleri saymaz', () => {
    const wk: Workout[] = history([[65, 8], [65, 8], [65, 8], [65, 8]])
    wk.push({
      id: 'x', d: '2026-09-20', start: 0, name: 'A',
      entries: [{ exId: 'bench', sets: [{ w: 100, r: 8, done: false }, { w: 100, r: 8, done: true, warmup: true }] }],
    })
    // 100 kg'lık yapılmamış ve ısınma setleri rekor sayılmaz: sonuç yalnız ilk dört seansa bağlı kalır.
    expect(detectPlateau(wk, 'bench')?.sessions).toBe(PLATEAU_SESSIONS)
  })
})
