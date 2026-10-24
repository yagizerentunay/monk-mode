import { describe, expect, it } from 'vitest'
import { migrate } from './migrate.ts'

const withSettings = (settings: Record<string, unknown>) => migrate({ version: 1, settings })

describe('migrate: ilerleme kuralı ve deload ertelemesi', () => {
  it("yalnız 'fast' saklanır; diğer her şey varsayılana (temkinli) düşer", () => {
    expect(withSettings({ progressionRule: 'fast' }).settings.progressionRule).toBe('fast')
    expect(withSettings({ progressionRule: 'cautious' }).settings.progressionRule).toBeUndefined()
    expect(withSettings({ progressionRule: 42 }).settings.progressionRule).toBeUndefined()
  })

  it('deload ertelemesi pozitif zaman olmalı', () => {
    expect(withSettings({ deloadSnoozedUntil: 1_000 }).settings.deloadSnoozedUntil).toBe(1_000)
    expect(withSettings({ deloadSnoozedUntil: -5 }).settings.deloadSnoozedUntil).toBeUndefined()
    expect(withSettings({ deloadSnoozedUntil: 'x' }).settings.deloadSnoozedUntil).toBeUndefined()
  })
})

describe('migrate: tema', () => {
  it("ayar yoksa (eski veri) 'system' olur", () => {
    expect(withSettings({}).settings.theme).toBe('system')
  })

  it("'dark' ve 'light' korunur", () => {
    expect(withSettings({ theme: 'dark' }).settings.theme).toBe('dark')
    expect(withSettings({ theme: 'light' }).settings.theme).toBe('light')
  })

  it("geçersiz değer 'system'e düşer", () => {
    for (const theme of ['Light', 'sepia', '', 1, null, true, { v: 'light' }]) {
      expect(withSettings({ theme }).settings.theme).toBe('system')
    }
  })
})

describe('migrate: arayüz dili', () => {
  it("ayar yoksa (eski veri) 'system' olur", () => {
    expect(withSettings({}).settings.language).toBe('system')
  })

  it("'system', 'tr' ve 'en' korunur", () => {
    for (const language of ['system', 'tr', 'en']) expect(withSettings({ language }).settings.language).toBe(language)
  })

  it("geçersiz değer 'system'e düşer", () => {
    for (const language of ['TR', 'en-US', 'de', '', 0, null, true, { v: 'en' }]) {
      expect(withSettings({ language }).settings.language).toBe('system')
    }
  })
})
