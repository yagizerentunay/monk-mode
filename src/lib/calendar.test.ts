import { describe, expect, it } from 'vitest'
import { formatAxisDay, formatDayTitle, formatShortDay, monthGrid, parseDay, shiftMonth, weekdayOrder } from './calendar.ts'

describe('ay ızgarası', () => {
  it('Ekim 2026 (Perşembe başlar) Pazartesi başlangıcında 5 hafta, ilk satır Eylül sonuyla dolar', () => {
    const g = monthGrid(2026, 9, 1)
    expect(g).toHaveLength(5)
    expect(g[0].map((c) => c.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(g[0].map((c) => c.inMonth)).toEqual([false, false, false, true, true, true, true])
    expect(g[4][6].date).toBe('2026-11-01')
    expect(g[4][6].inMonth).toBe(false)
  })

  it('hafta başlangıcına göre sütunları kaydırır', () => {
    const sun = monthGrid(2026, 9, 0)
    expect(sun[0][0].date).toBe('2026-09-27')
    expect(sun[0][0].dow).toBe(0)
    const sat = monthGrid(2026, 9, 6)
    expect(sat[0][0].date).toBe('2026-09-26')
    expect(sat[0][0].dow).toBe(6)
  })

  it('her ayın tüm günlerini tam bir kez içerir', () => {
    for (const [y, m] of [[2026, 1], [2024, 1], [2026, 9], [2026, 11], [2025, 2]]) {
      const days = monthGrid(y, m, 1).flat().filter((c) => c.inMonth)
      expect(days).toHaveLength(new Date(y, m + 1, 0).getDate())
      expect(new Set(days.map((c) => c.date)).size).toBe(days.length)
    }
  })

  it('satır sayısı 4 ile 6 arasındadır; 1 Şubat 2026 Pazar: Pazar başlangıcında tam 4, Pazartesi başlangıcında 5 hafta', () => {
    expect(monthGrid(2026, 1, 0)).toHaveLength(4)
    expect(monthGrid(2026, 1, 1)).toHaveLength(5)
    for (let m = 0; m < 12; m++) {
      for (const ws of [0, 1, 6]) {
        const n = monthGrid(2026, m, ws).length
        expect(n).toBeGreaterThanOrEqual(4)
        expect(n).toBeLessThanOrEqual(6)
      }
    }
  })

  it('her satır 7 gün ve ardışık günlerden oluşur (yaz saati geçişi dahil)', () => {
    const flat = monthGrid(2026, 9, 1).flat()
    for (let i = 1; i < flat.length; i++) {
      const diff = (parseDay(flat[i].date).getTime() - parseDay(flat[i - 1].date).getTime()) / 86400000
      expect(Math.round(diff)).toBe(1)
    }
    for (const row of monthGrid(2026, 2, 1)) expect(row).toHaveLength(7)
  })
})

describe('ay kaydırma', () => {
  it('yıl sınırını geçer', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 })
    expect(shiftMonth(2026, 5, 14)).toEqual({ year: 2027, month: 7 })
  })
})

describe('başlıklar', () => {
  it('haftanın günlerini hafta başlangıcından sıralar', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
  })

  it('günü Türkçe yazar', () => {
    expect(formatDayTitle('2026-10-06')).toBe('Salı, 6 Ekim 2026')
    expect(formatDayTitle('2026-01-01')).toBe('Perşembe, 1 Ocak 2026')
  })

  it('grafik ekseni için ayı üç harfe kısaltır, yıl farklıysa ekler', () => {
    const today = new Date(2026, 9, 8)
    expect(formatAxisDay('2026-10-01', today)).toBe('1 Eki')
    expect(formatAxisDay('2026-01-15', today)).toBe('15 Oca')
    expect(formatAxisDay('2025-12-30', today)).toBe('30 Ara 2025')
  })

  it('üç harfli ay kısaltmaları birbirinden ayrışır', () => {
    const abbr = Array.from({ length: 12 }, (_, m) => formatAxisDay(`2026-${String(m + 1).padStart(2, '0')}-01`, new Date(2026, 0, 1)))
    expect(new Set(abbr).size).toBe(12)
  })

  it('kısa günde yılı yalnız bugünkünden farklıysa ekler', () => {
    const today = new Date(2026, 9, 8)
    expect(formatShortDay('2026-10-06', today)).toBe('6 Ekim')
    expect(formatShortDay('2025-12-31', today)).toBe('31 Aralık 2025')
    expect(formatShortDay('2027-01-02', today)).toBe('2 Ocak 2027')
  })
})
