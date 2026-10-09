import { describe, expect, it } from 'vitest'
import { fmt, fmtDelta, weekRows } from './muscleWeek.ts'
import { emptyMuscleSets, MUSCLES, type MuscleSets } from './muscles.ts'

function cmp(thisWeek: Partial<MuscleSets>, lastWeek: Partial<MuscleSets> = {}) {
  const t = { ...emptyMuscleSets(), ...thisWeek }
  const l = { ...emptyMuscleSets(), ...lastWeek }
  const delta = emptyMuscleSets()
  for (const m of MUSCLES) delta[m] = t[m] - l[m]
  return { thisWeek: t, lastWeek: l, delta }
}

describe('weekRows', () => {
  it('varsayılan hedeflerle 17 kasın hepsi satırdır, çalışılmamışlar 0/10 olarak', () => {
    const { rows, hidden } = weekRows(cmp({ chest: 4 }), undefined)
    expect(rows).toHaveLength(MUSCLES.length)
    expect(hidden).toEqual([])
    const glutes = rows.find((r) => r.muscle === 'glutes')!
    expect(glutes).toMatchObject({ sets: 0, lastWeek: 0, target: 10, below: true })
  })

  it('sıra: bu hafta çok olan, eşitlikte geçen hafta çok olan, sonra MUSCLE_PRIORITY sırası', () => {
    const { rows } = weekRows(cmp({ lats: 6, chest: 6, biceps: 2 }, { chest: 3, triceps: 9 }), undefined)
    expect(rows.slice(0, 5).map((r) => r.muscle)).toEqual(['chest', 'lats', 'biceps', 'triceps', 'glutes'])
    // Hiç çalışılmamış kaslar arasında küçükler en sonda: boyun listenin dibinde.
    expect(rows[rows.length - 1].muscle).toBe('neck')
  })

  it('hedefe ulaşan ya da aşan kas "below" değildir', () => {
    const { rows } = weekRows(cmp({ chest: 10, lats: 12, biceps: 9.5 }), undefined)
    const by = Object.fromEntries(rows.map((r) => [r.muscle, r.below]))
    expect(by.chest).toBe(false)
    expect(by.lats).toBe(false)
    expect(by.biceps).toBe(true)
  })

  it('kas başına hedef uygulanır', () => {
    const { rows } = weekRows(cmp({ chest: 6 }), { chest: 6, lats: 20 })
    expect(rows.find((r) => r.muscle === 'chest')).toMatchObject({ target: 6, below: false })
    expect(rows.find((r) => r.muscle === 'lats')).toMatchObject({ target: 20, below: true })
  })

  it('hedefi 0 olan çalışılmamış kas listede yoktur (hidden), çalışılmışsa hedefsiz satırdır ve eksik sayılmaz', () => {
    const { rows, hidden } = weekRows(cmp({ neck: 3 }, { traps: 2 }), { neck: 0, traps: 0, forearms: 0 })
    expect(hidden).toEqual(['forearms'])
    expect(rows.find((r) => r.muscle === 'neck')).toMatchObject({ sets: 3, target: 0, below: false })
    expect(rows.find((r) => r.muscle === 'traps')).toMatchObject({ sets: 0, lastWeek: 2, target: 0, below: false })
    expect(rows.some((r) => r.muscle === 'forearms')).toBe(false)
  })

  it('fark ve geçen hafta değerini taşır', () => {
    const { rows } = weekRows(cmp({ chest: 4 }, { chest: 7 }), undefined)
    expect(rows[0]).toMatchObject({ muscle: 'chest', delta: -3, lastWeek: 7 })
  })

  it('girdiyi değiştirmez', () => {
    const input = cmp({ chest: 4 })
    const before = structuredClone(input)
    weekRows(input, { chest: 3 })
    expect(input).toEqual(before)
  })
})

describe('biçimleme', () => {
  it('fmt virgül kullanır, fmtDelta işaret ve eşitlik gösterir', () => {
    expect(fmt(6.5)).toBe('6,5')
    expect(fmt(10)).toBe('10')
    expect(fmtDelta(3)).toBe('+3')
    expect(fmtDelta(-2)).toBe('−2')
    expect(fmtDelta(0.04)).toBe('=')
    expect(fmtDelta(0.5)).toBe('+0,5')
  })
})
