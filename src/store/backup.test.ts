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

describe('kilo hedefi ayarı', () => {
  it('geçerli hedefi (0 dahil, negatif dahil) korur, bozuk ya da aşırı değeri atar', () => {
    expect(migrate({ settings: { bodyweightGoal: 0.25 } }).settings.bodyweightGoal).toBe(0.25)
    expect(migrate({ settings: { bodyweightGoal: 0 } }).settings.bodyweightGoal).toBe(0)
    expect(migrate({ settings: { bodyweightGoal: -0.5 } }).settings.bodyweightGoal).toBe(-0.5)
    expect(migrate({ settings: { bodyweightGoal: 9 } }).settings.bodyweightGoal).toBeUndefined()
    expect(migrate({ settings: { bodyweightGoal: 'x' } }).settings.bodyweightGoal).toBeUndefined()
    expect(migrate({}).settings.bodyweightGoal).toBeUndefined()
  })
})

describe('yedek hatırlatma ayarları', () => {
  it('varsayılanı 14 gün yapar, bozuk değerleri atar', () => {
    expect(migrate({}).settings.backupRemindDays).toBe(14)
    const s = migrate({
      settings: { backupRemindDays: -3, lastBackupAt: 'x', lastBackupHash: 5, backupSnoozedUntil: -1 },
    })
    expect(s.settings.backupRemindDays).toBe(14)
    expect(s.settings.lastBackupAt).toBeUndefined()
    expect(s.settings.lastBackupHash).toBeUndefined()
    expect(s.settings.backupSnoozedUntil).toBeUndefined()
  })

  it('geçerli değerleri ve yedek turunu korur', () => {
    const s = migrate({ settings: { backupRemindDays: 0, lastBackupAt: 1700000000000, lastBackupHash: 'abc' } })
    expect(s.settings).toMatchObject({ backupRemindDays: 0, lastBackupAt: 1700000000000, lastBackupHash: 'abc' })
    expect(importBackup(exportBackup(s)).settings.lastBackupHash).toBe('abc')
  })
})
