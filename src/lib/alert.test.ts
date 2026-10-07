import { describe, expect, it } from 'vitest'
import { formatClock } from './alert.ts'

describe('formatClock', () => {
  it('saniyeyi dakika:saniye yazar', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(3600)).toBe('60:00')
  })

  it('negatif değeri sıfıra çeker', () => {
    expect(formatClock(-4)).toBe('0:00')
  })
})
