import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { weekStartOf, weekStreak } from './streak.ts'

const wk = (d: string): Workout => ({ id: d, d, start: 0, name: 't', entries: [] })

// 8 Ekim 2026 Perşembe; hafta Pazartesi başlar.
const today = new Date(2026, 9, 8)

describe('hafta başlangıcı', () => {
  it('Pazartesi başlangıcında Perşembe için o haftanın Pazartesisini verir', () => {
    expect(weekStartOf(today, 1)).toEqual(new Date(2026, 9, 5))
  })

  it('Pazar başlangıcında bir önceki Pazarı verir', () => {
    expect(weekStartOf(today, 0)).toEqual(new Date(2026, 9, 4))
  })
})

describe('hafta serisi', () => {
  it('antrenman yoksa 0', () => {
    expect(weekStreak([], today, 1)).toBe(0)
  })

  it('ardışık haftaları sayar', () => {
    const ws = [wk('2026-10-06'), wk('2026-09-30'), wk('2026-09-22')]
    expect(weekStreak(ws, today, 1)).toBe(3)
  })

  it('bu hafta henüz antrenman yoksa seri bozulmaz', () => {
    const ws = [wk('2026-09-30'), wk('2026-09-22')]
    expect(weekStreak(ws, today, 1)).toBe(2)
  })

  it('boş hafta seriyi keser', () => {
    const ws = [wk('2026-10-06'), wk('2026-09-22')]
    expect(weekStreak(ws, today, 1)).toBe(1)
  })
})
