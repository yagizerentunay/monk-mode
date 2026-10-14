import { describe, expect, it } from 'vitest'
import { clampSec, elapsedSec, formatClockField, formatDuration, MAX_TIMED_SEC, parseDuration } from './timed.ts'

describe('süre biçimi', () => {
  it('bir dakikanın altını "45 sn", üstünü "1:30" yazar', () => {
    expect(formatDuration(0)).toBe('0 sn')
    expect(formatDuration(45)).toBe('45 sn')
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(90)).toBe('1:30')
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('aralık dışı ve geçersiz değerleri 0-3600e çeker', () => {
    expect(clampSec(-5)).toBe(0)
    expect(clampSec(Number.NaN)).toBe(0)
    expect(clampSec(Infinity)).toBe(0)
    expect(clampSec(99_999)).toBe(MAX_TIMED_SEC)
    expect(formatDuration(99_999)).toBe('60:00')
  })

  it('alan gösterimi her zaman d:ss', () => {
    expect(formatClockField(45)).toBe('0:45')
    expect(formatClockField(125)).toBe('2:05')
  })
})

describe('süre ayrıştırma', () => {
  it('saniye, d:ss ve ondalık girdiyi okur', () => {
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration(' 1:30 ')).toBe(90)
    expect(parseDuration('0:45')).toBe(45)
    expect(parseDuration('1,6')).toBe(2)
    expect(parseDuration('2:5')).toBe(125)
  })

  it('çözülemeyeni null, aşırıyı 3600 yapar', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('-5')).toBeNull()
    expect(parseDuration('1:75')).toBeNull()
    expect(parseDuration('99999')).toBe(3600)
  })
})

describe('kronometre', () => {
  it('geçen saniyeyi damgadan hesaplar, saat geri giderse 0 verir, 3600de durur', () => {
    expect(elapsedSec(1_000, 1_000)).toBe(0)
    expect(elapsedSec(1_000, 1_999)).toBe(0)
    expect(elapsedSec(1_000, 46_400)).toBe(45)
    expect(elapsedSec(5_000, 1_000)).toBe(0)
    expect(elapsedSec(0, 99_999_000)).toBe(3600)
  })
})
