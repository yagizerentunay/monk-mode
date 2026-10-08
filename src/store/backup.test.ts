import { describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from './backup.ts'
import { migrate } from './migrate.ts'
import { defaultState } from './schema.ts'

describe('migrate', () => {
  it('geçersiz girdide varsayılan state döner', () => {
    expect(migrate(null)).toEqual(defaultState())
    expect(migrate('x')).toEqual(defaultState())
    expect(migrate([])).toEqual(defaultState())
  })

  it('eksik alanları varsayılanlarla tamamlar', () => {
    const s = migrate({ settings: { unit: 'lb' } })
    expect(s.settings).toEqual({ ...defaultState().settings, unit: 'lb' })
    expect(s.workouts).toEqual([])
  })

  it('plaka kitini doğrular: bozuk değerleri atar, plakaları sıralar ve tekilleştirir', () => {
    const s = migrate({
      settings: {
        plateKit: { kg: { bar: 15, plates: [5, 20, 5, -1, 'x', 0, 500, 10] }, lb: { bar: 'x', plates: 'y' } },
      },
    })
    expect(s.settings.plateKit.kg).toEqual({ bar: 15, plates: [20, 10, 5] })
    expect(s.settings.plateKit.lb).toEqual(defaultState().settings.plateKit.lb)
  })

  it('kayıtlı plaka kitini korur, eksik birimi varsayılanla doldurur', () => {
    const s = migrate({ settings: { plateKit: { kg: { bar: 10, plates: [] } } } })
    expect(s.settings.plateKit.kg).toEqual({ bar: 10, plates: [] })
    expect(s.settings.plateKit.lb.bar).toBe(45)
  })

  it('bozuk ayar değerlerini atar', () => {
    const s = migrate({ settings: { unit: 'stone', restSec: -5, weekStart: 9 } })
    expect(s.settings).toEqual(defaultState().settings)
  })
})

describe('yedek', () => {
  it('dışa aktarılan yedek geri yüklenir', () => {
    const state = { ...defaultState(), bodyweight: [{ d: '2026-10-08', w: 80.4 }] }
    expect(importBackup(exportBackup(state))).toEqual(state)
  })

  it('JSON olmayan dosyayı reddeder', () => {
    expect(() => importBackup('not json')).toThrow('JSON')
  })

  it('başka uygulamanın dosyasını reddeder', () => {
    expect(() => importBackup('{"app":"other","state":{}}')).toThrow('monk-mode')
  })
})
