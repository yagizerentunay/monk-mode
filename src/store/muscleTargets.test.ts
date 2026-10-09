import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from './backup.ts'
import { migrate } from './migrate.ts'
import { defaultState } from './schema.ts'
import { snapshot, useStore } from './useStore.ts'

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

const withTargets = (muscleTargets: unknown) =>
  migrate({ ...defaultState(), settings: { ...defaultState().settings, muscleTargets } })

describe('migrate: kas hedefleri', () => {
  it('eski kayıtta (alan yok) hedef yoktur', () => {
    const { muscleTargets: _drop, ...settings } = defaultState().settings
    expect(migrate({ ...defaultState(), settings }).settings.muscleTargets).toBeUndefined()
    expect(migrate({}).settings.muscleTargets).toBeUndefined()
  })

  it('geçerli hedefleri tutar, 0 ve 40 sınır değerleri dahil', () => {
    expect(withTargets({ chest: 14, glutes: 0, lats: 40 }).settings.muscleTargets).toEqual({ chest: 14, glutes: 0, lats: 40 })
  })

  it('bozuk, negatif, NaN, çok büyük ve sayı olmayan değerleri atar', () => {
    const out = withTargets({
      chest: -1,
      lats: 41,
      biceps: Number.NaN,
      triceps: Infinity,
      calves: '12',
      neck: null,
      glutes: 12,
    })
    expect(out.settings.muscleTargets).toEqual({ glutes: 12 })
  })

  it('kesirli değeri yuvarlar', () => {
    expect(withTargets({ chest: 7.4, lats: 7.5 }).settings.muscleTargets).toEqual({ chest: 7, lats: 8 })
  })

  it('bilinmeyen kas anahtarlarını atar; hiç geçerli hedef kalmazsa alan undefined olur', () => {
    expect(withTargets({ foo: 5, 'upper chest': 8, toString: 4 }).settings.muscleTargets).toBeUndefined()
    expect(withTargets({ foo: 5, chest: 9 }).settings.muscleTargets).toEqual({ chest: 9 })
  })

  it('dizi, metin ve sayı ayar olarak kabul edilmez', () => {
    for (const bad of [[1, 2], 'chest', 5, null, true]) expect(withTargets(bad).settings.muscleTargets).toBeUndefined()
  })

  it('__proto__ anahtarı prototipi bozmaz', () => {
    const raw = JSON.parse('{"__proto__": {"polluted": 1}, "chest": 12}')
    const out = withTargets(raw)
    expect(Object.getPrototypeOf(out.settings.muscleTargets)).toBe(Object.prototype)
    expect(out.settings.muscleTargets).toEqual({ chest: 12 })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('store ve yedek: kas hedefleri', () => {
  it('setSettings hedefi kaydeder ve snapshot içerir', () => {
    useStore.getState().setSettings({ muscleTargets: { glutes: 12 } })
    expect(snapshot(useStore.getState()).settings.muscleTargets).toEqual({ glutes: 12 })
  })

  it('hedefli yedek dışa/içe aktarmada korunur', () => {
    useStore.getState().setSettings({ muscleTargets: { glutes: 12, abdominals: 0 } })
    const text = exportBackup(snapshot(useStore.getState()))
    expect(importBackup(text).settings.muscleTargets).toEqual({ glutes: 12, abdominals: 0 })
  })

  it('hedefsiz (eski) yedek yüklenir ve hedef tanımsız kalır', () => {
    const old = JSON.stringify({
      app: 'monk-mode',
      exportedAt: '2026-01-01T00:00:00.000Z',
      state: { ...defaultState(), settings: { unit: 'kg', restSec: 75, weekStart: 1, backupRemindDays: 14 } },
    })
    const state = importBackup(old)
    expect(state.settings.muscleTargets).toBeUndefined()
    expect(state.settings.restSec).toBe(75)
  })

  it('yedekteki bozuk hedefler yüklemede temizlenir', () => {
    const text = JSON.stringify({
      app: 'monk-mode',
      exportedAt: '2026-01-01T00:00:00.000Z',
      state: { ...defaultState(), settings: { ...defaultState().settings, muscleTargets: { chest: 15, lats: -3, x: 4 } } },
    })
    expect(importBackup(text).settings.muscleTargets).toEqual({ chest: 15 })
  })

  it('replaceAll ile hedefli yedek yüklenince depoda görünür', () => {
    const state = importBackup(
      exportBackup({ ...defaultState(), settings: { ...defaultState().settings, muscleTargets: { calves: 6 } } }),
    )
    useStore.getState().replaceAll(state)
    expect(useStore.getState().settings.muscleTargets).toEqual({ calves: 6 })
  })
})
