import { afterEach, describe, expect, it } from 'vitest'
import { formatAxisDay, formatDateTime, formatDayTitle, formatShortDay } from '../lib/calendar.ts'
import { DAY_NAMES, DAY_SHORT } from '../lib/dates.ts'
import { formatDistance } from '../lib/distance.ts'
import { equipmentLabel, muscleLabel } from '../lib/labels.ts'
import { fmt } from '../lib/muscleWeek.ts'
import { formatDuration } from '../lib/timed.ts'
import { formatDecimal, formatWeight } from '../lib/units.ts'
import { setLanguageSetting } from './index.ts'

afterEach(() => setLanguageSetting('system'))

const today = new Date(2026, 9, 24)

describe('biçimlendirme: Türkçe', () => {
  it('ondalık virgül', () => {
    expect(formatDecimal(62.5)).toBe('62,5')
    expect(formatWeight(102.5, 'kg')).toBe('102,5')
    expect(fmt(6.5)).toBe('6,5')
    expect(formatDistance(5250)).toBe('5,25 km')
  })

  it('tarih ve gün adları', () => {
    expect(formatShortDay('2026-10-06', today)).toBe('6 Ekim')
    expect(formatShortDay('2025-10-06', today)).toBe('6 Ekim 2025')
    expect(formatAxisDay('2026-10-06', today)).toBe('6 Eki')
    expect(formatDayTitle('2026-10-06')).toBe('Salı, 6 Ekim 2026')
    expect(DAY_NAMES[1]).toBe('Pazartesi')
    expect(DAY_SHORT[0]).toBe('Paz')
  })

  it('süre ve etiketler', () => {
    expect(formatDuration(45)).toBe('45 sn')
    expect(formatDuration(90)).toBe('1:30')
    expect(muscleLabel('chest')).toBe('Göğüs')
    expect(equipmentLabel(null)).toBe('Ekipmansız')
  })
})

describe('biçimlendirme: İngilizce', () => {
  it('ondalık nokta', () => {
    setLanguageSetting('en')
    expect(formatDecimal(62.5)).toBe('62.5')
    expect(formatWeight(102.5, 'kg')).toBe('102.5')
    expect(fmt(6.5)).toBe('6.5')
    expect(formatDistance(5250)).toBe('5.25 km')
  })

  it('tarih ve gün adları', () => {
    setLanguageSetting('en')
    expect(formatShortDay('2026-10-06', today)).toBe('October 6')
    expect(formatShortDay('2025-10-06', today)).toBe('October 6, 2025')
    expect(formatAxisDay('2026-10-06', today)).toBe('Oct 6')
    expect(formatDayTitle('2026-10-06')).toBe('Tuesday, October 6, 2026')
    expect(DAY_NAMES[1]).toBe('Monday')
    expect(DAY_SHORT[0]).toBe('Sun')
    expect(formatDateTime(new Date(2026, 9, 6, 9, 5).getTime())).toMatch(/^Oct 6, 2026/)
  })

  it('süre ve etiketler', () => {
    setLanguageSetting('en')
    expect(formatDuration(45)).toBe('45 s')
    expect(muscleLabel('chest')).toBe('Chest')
    expect(muscleLabel('hip flexors')).toBe('Hip flexors')
    expect(muscleLabel('custom thing')).toBe('custom thing')
    expect(equipmentLabel('body only')).toBe('Bodyweight')
    expect(equipmentLabel(null)).toBe('No equipment')
  })
})
