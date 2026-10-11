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
