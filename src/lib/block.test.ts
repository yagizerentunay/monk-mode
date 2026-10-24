import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PastBlock, TrainingBlock, Workout } from '../store/schema.ts'
import {
  addPastBlock,
  blockLastDay,
  blockStatus,
  blockWeekOf,
  blockWeekRange,
  clampWeeks,
  closeBlock,
  editBlock,
  inDeloadWeek,
  MAX_PAST_BLOCKS,
  newBlock,
  planDeloadThisWeek,
  withoutDeloadWeeks,
} from './block.ts'

const blk = (over: Partial<TrainingBlock> = {}): TrainingBlock => ({ id: 'b', start: '2026-10-07', weeks: 5, deload: 5, ...over })
const wk = (id: string, d: string): Workout => ({ id, d, start: 0, name: 't', entries: [] })
const MON = 1
const SUN = 0

// 7 Ekim 2026 Çarşamba. Pazartesi başlangıcında 1. hafta 5–11 Ekim, Pazar başlangıcında 4–10 Ekim.
describe('blok haftası', () => {
  it('1. hafta başlangıç gününün takvim haftasıdır (weekStart Pazartesi)', () => {
    const b = blk()
    expect(blockWeekOf(b, new Date(2026, 9, 5), MON)).toBe(1)
    expect(blockWeekOf(b, new Date(2026, 9, 11), MON)).toBe(1)
    expect(blockWeekOf(b, new Date(2026, 9, 12), MON)).toBe(2)
    expect(blockWeekOf(b, new Date(2026, 9, 4), MON)).toBe(0)
  })

  it('weekStart Pazar ise hafta Pazar günü değişir', () => {
    const b = blk()
    expect(blockWeekOf(b, new Date(2026, 9, 10), SUN)).toBe(1)
    expect(blockWeekOf(b, new Date(2026, 9, 11), SUN)).toBe(2)
    expect(blockWeekOf(b, new Date(2026, 9, 11), MON)).toBe(1)
  })

  it('gün sınırı: haftanın son gününün son anı aynı hafta, ertesi gece yarısı yeni hafta', () => {
    const b = blk()
    expect(blockWeekOf(b, new Date(2026, 9, 11, 23, 59, 59, 999), MON)).toBe(1)
    expect(blockWeekOf(b, new Date(2026, 9, 12, 0, 0, 0, 0), MON)).toBe(2)
  })

  it('yaz saati geçişini (25 Ekim, 29 Mart) aşan blokta haftalar kaymaz', () => {
    const autumn = blk({ start: '2026-10-19', weeks: 4 })
    expect(blockWeekOf(autumn, new Date(2026, 9, 25, 23, 30), MON)).toBe(1)
    expect(blockWeekOf(autumn, new Date(2026, 9, 26, 0, 0), MON)).toBe(2)
    expect(blockWeekOf(autumn, new Date(2026, 10, 15, 23, 59), MON)).toBe(4)
    const spring = blk({ start: '2027-03-22', weeks: 4 })
    expect(blockWeekOf(spring, new Date(2027, 2, 28, 23, 59), MON)).toBe(1)
    expect(blockWeekOf(spring, new Date(2027, 2, 29, 0, 0), MON)).toBe(2)
  })

  it('durum: başlamadı / sürüyor / deload / süresi doldu', () => {
    const b = blk()
    expect(blockStatus(b, new Date(2026, 9, 1), MON)).toMatchObject({ phase: 'upcoming', deload: false })
    expect(blockStatus(b, new Date(2026, 9, 20), MON)).toEqual({ phase: 'running', week: 3, weeks: 5, deload: false })
    expect(blockStatus(b, new Date(2026, 10, 2), MON)).toEqual({ phase: 'running', week: 5, weeks: 5, deload: true })
    expect(blockStatus(b, new Date(2026, 10, 9), MON)).toMatchObject({ phase: 'over', week: 6, deload: false })
  })

  it('hafta aralığı ve son gün', () => {
    const b = blk()
    expect(blockWeekRange(b, 1, MON)).toEqual({ first: '2026-10-05', last: '2026-10-11' })
    expect(blockWeekRange(b, 5, MON)).toEqual({ first: '2026-11-02', last: '2026-11-08' })
    expect(blockWeekRange(b, 1, SUN)).toEqual({ first: '2026-10-04', last: '2026-10-10' })
    expect(blockLastDay(b, MON)).toBe('2026-11-08')
  })
})

describe('deload haftası', () => {
  it('yalnız deload haftasının günleri', () => {
    const b = blk({ deload: 3 })
    expect(inDeloadWeek(b, '2026-10-18', MON)).toBe(false)
    expect(inDeloadWeek(b, '2026-10-19', MON)).toBe(true)
    expect(inDeloadWeek(b, '2026-10-25', MON)).toBe(true)
    expect(inDeloadWeek(b, '2026-10-26', MON)).toBe(false)
  })

  it('biten blokta bitiş gününden sonrası sayılmaz', () => {
    const past: PastBlock = { ...blk({ deload: 3 }), end: '2026-10-20', outcome: 'cancelled' }
    expect(inDeloadWeek(past, '2026-10-20', MON)).toBe(true)
    expect(inDeloadWeek(past, '2026-10-21', MON)).toBe(false)
  })

  it('deload haftasındaki antrenmanlar çıkarılır; blok yoksa liste aynen döner', () => {
    const ws = [wk('a', '2026-10-30'), wk('b', '2026-11-03'), wk('c', '2026-11-09')]
    expect(withoutDeloadWeeks(ws, [blk()], MON).map((w) => w.id)).toEqual(['a', 'c'])
    expect(withoutDeloadWeeks(ws, [], MON)).toBe(ws)
  })
})

describe('blok oluşturma ve düzenleme', () => {
  it('hafta sayısı 4-6 aralığına çekilir, deload varsayılan son hafta', () => {
    expect(newBlock('x', '2026-10-07', 5)).toEqual({ id: 'x', start: '2026-10-07', weeks: 5, deload: 5 })
    expect(newBlock('x', '2026-10-07', 9).weeks).toBe(6)
    expect(newBlock('x', '2026-10-07', 2).weeks).toBe(4)
    expect(newBlock('x', '2026-10-07', 4, 9).deload).toBe(4)
    expect(newBlock('x', '2026-10-07', 4, 0).deload).toBe(1)
    expect(clampWeeks('5')).toBe(5)
    expect(clampWeeks(4.6)).toBe(5)
  })

  it('deload son haftadaysa hafta sayısıyla birlikte kayar', () => {
    expect(editBlock(blk(), { weeks: 6 })).toMatchObject({ weeks: 6, deload: 6 })
    expect(editBlock(blk(), { weeks: 4 })).toMatchObject({ weeks: 4, deload: 4 })
  })

  it('deload başka haftadaysa yerinde kalır, aşarsa son haftaya çekilir', () => {
    expect(editBlock(blk({ deload: 3 }), { weeks: 6 })).toMatchObject({ weeks: 6, deload: 3 })
    expect(editBlock(blk({ weeks: 6, deload: 5 }), { weeks: 4 })).toMatchObject({ weeks: 4, deload: 4 })
    expect(editBlock(blk(), { deload: 2, start: '2026-10-12' })).toMatchObject({ start: '2026-10-12', deload: 2 })
  })

  it('geçmiş bitişe göre sıralı ve sınırlı; aynı kimlik yenilenir', () => {
    const past = (id: string, end: string): PastBlock => closeBlock(blk({ id }), end, 'done')
    let list: PastBlock[] = []
    for (let i = 0; i < MAX_PAST_BLOCKS + 2; i++) list = addPastBlock(list, past(`p${i}`, `2026-01-${String(28 - i).padStart(2, '0')}`))
    expect(list).toHaveLength(MAX_PAST_BLOCKS)
    expect(list[0].end < list[list.length - 1].end).toBe(true)
    expect(list.map((p) => p.id)).not.toContain(`p${MAX_PAST_BLOCKS + 1}`)
    const again = addPastBlock(list, { ...past('p0', '2026-02-01'), outcome: 'cancelled' })
    expect(again.filter((p) => p.id === 'p0')).toEqual([{ ...past('p0', '2026-02-01'), outcome: 'cancelled' }])
  })
})

describe("deload'u bu haftaya planla", () => {
  const today = new Date(2026, 9, 21) // 3. hafta

  it('süren blokta deload bu haftaya taşınır', () => {
    expect(planDeloadThisWeek(blk(), today, MON, 'n')).toEqual({ block: blk({ deload: 3 }) })
  })

  it('blok yoksa bu hafta başlayan, ilk haftası deload olan blok kurulur', () => {
    expect(planDeloadThisWeek(null, today, MON, 'n')).toEqual({
      block: { id: 'n', start: '2026-10-21', weeks: 5, deload: 1 },
    })
  })

  it('süresi dolan blok bitti olarak kapanır, yenisi kurulur', () => {
    const old = blk({ start: '2026-08-03', weeks: 4 })
    const plan = planDeloadThisWeek(old, today, MON, 'n')
    expect(plan?.closed).toEqual({ ...old, end: '2026-08-30', outcome: 'done' })
    expect(plan?.block).toMatchObject({ id: 'n', deload: 1 })
  })

  it('henüz başlamamış bloğun planı bozulmaz', () => {
    expect(planDeloadThisWeek(blk({ start: '2026-11-02' }), today, MON, 'n')).toBeUndefined()
  })
})

describe('saat dilimi (Europe/Istanbul dışı, yaz saatli)', () => {
  beforeAll(() => {
    vi.stubEnv('TZ', 'Europe/Berlin')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('yaz saati geçişi olan günde de hafta doğru değişir', () => {
    // 25 Ekim 2026 yaz saatinden çıkış: o gün 25 saattir.
    expect(new Date(2026, 9, 24).getTimezoneOffset()).not.toBe(new Date(2026, 9, 26).getTimezoneOffset())
    const b = blk({ start: '2026-10-19', weeks: 4 })
    expect(blockWeekOf(b, new Date(2026, 9, 25, 12), MON)).toBe(1)
    expect(blockWeekOf(b, new Date(2026, 9, 26, 0, 0), MON)).toBe(2)
    expect(blockWeekRange(b, 2, MON)).toEqual({ first: '2026-10-26', last: '2026-11-01' })
  })
})
