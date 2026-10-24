import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup, importBackupWithReport } from './backup.ts'
import { migrate, migrateWithReport } from './migrate.ts'
import { defaultState, type MeasurementEntry, type State } from './schema.ts'
import { snapshot, useStore } from './useStore.ts'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('store: logMeasurement', () => {
  it('kaydı tarih sırasına ekler', () => {
    const s = useStore.getState()
    s.logMeasurement({ d: '2026-10-03', waist: 82 })
    s.logMeasurement({ d: '2026-10-01', waist: 84, fat: 18 })
    expect(useStore.getState().measurements).toEqual([
      { d: '2026-10-01', waist: 84, fat: 18 },
      { d: '2026-10-03', waist: 82 },
    ])
  })

  it('aynı güne ikinci giriş öncekinin yerine geçer', () => {
    const s = useStore.getState()
    s.logMeasurement({ d: '2026-10-01', waist: 84, arm: 35 })
    s.logMeasurement({ d: '2026-10-01', chest: 101 })
    expect(useStore.getState().measurements).toEqual([{ d: '2026-10-01', chest: 101 }])
  })

  it('geçerli ölçüsü olmayan girişi yok sayar, değerleri temizler', () => {
    const s = useStore.getState()
    s.logMeasurement({ d: '2026-10-01', waist: 0, fat: 150 })
    expect(useStore.getState().measurements).toEqual([])
    s.logMeasurement({ d: '2026-10-01', hip: 98.04, fat: 150 })
    expect(useStore.getState().measurements).toEqual([{ d: '2026-10-01', hip: 98 }])
  })

  it('snapshot ölçüleri taşır', () => {
    useStore.getState().logMeasurement({ d: '2026-10-01', waist: 80 })
    expect(snapshot(useStore.getState()).measurements).toEqual([{ d: '2026-10-01', waist: 80 }])
  })
})

describe('migrate: ölçüler', () => {
  it('alanı olmayan eski veride boş liste', () => {
    const { measurements: _drop, ...old } = defaultState()
    const { state, report } = migrateWithReport(old)
    expect(state.measurements).toEqual([])
    expect(report.dropped.measurement).toBe(0)
  })

  it('geçerli kayıtlar bayt bayt aynı kalır', () => {
    const measurements: MeasurementEntry[] = [
      { d: '2026-10-01', fat: 18, waist: 84 },
      { d: '2026-10-02', arm: 35.5 },
    ]
    const { state, report } = migrateWithReport({ ...defaultState(), measurements })
    expect(JSON.stringify(state.measurements)).toBe(JSON.stringify(measurements))
    expect(report.repaired.measurement).toBe(0)
  })

  it('bozuk kayıtları atar, bozuk alanları onarır', () => {
    const { state, report } = migrateWithReport({
      measurements: [
        { d: '2026-10-01', waist: 84, chest: 'x', extra: 1 },
        { d: '2026-10-02', arm: 35.55 },
        { d: '2026-13-40', waist: 80 },
        { d: '2026-10-03' },
        { d: '2026-10-04', fat: 0, hip: -2 },
        null,
        'x',
      ],
    })
    expect(state.measurements).toEqual([
      { d: '2026-10-01', waist: 84 },
      { d: '2026-10-02', arm: 35.6 },
    ])
    expect(report.dropped.measurement).toBe(5)
    expect(report.repaired.measurement).toBe(2)
    expect(migrateWithReport({ measurements: 'x' }).report.dropped.measurement).toBe(1)
  })

  it('idempotent: sonucu yeniden migrate etmek değiştirmez', () => {
    const once = migrate({ measurements: [{ d: '2026-10-01', waist: 84.04, fat: '1' }, { d: '2026-10-02', hip: 99 }] })
    const twice = migrateWithReport(clone(once))
    expect(twice.state).toEqual(once)
    expect(twice.report.repaired.measurement).toBe(0)
  })
})

describe('yedek: ölçüler', () => {
  const withData = (): State => ({
    ...defaultState(),
    measurements: [
      { d: '2026-10-01', waist: 84, chest: 102, arm: 36, hip: 98, fat: 17.5 },
      { d: '2026-10-08', waist: 83 },
    ],
  })

  it('dışa aktarılıp geri yüklenince aynen döner', () => {
    const s = withData()
    expect(importBackup(exportBackup(s)).measurements).toEqual(s.measurements)
  })

  it('yedekteki bozuk ölçü kaydı atlanır ve raporlanır', () => {
    const s = withData()
    const text = exportBackup({ ...s, measurements: [...s.measurements, { d: 'x', waist: 1 }] as MeasurementEntry[] })
    const { state, report } = importBackupWithReport(text)
    expect(state.measurements).toEqual(s.measurements)
    expect(report.dropped.measurement).toBe(1)
  })

  it('geri yüklenen yedek store\'a geçer', () => {
    useStore.getState().replaceAll(importBackup(exportBackup(withData())))
    expect(useStore.getState().measurements).toHaveLength(2)
  })

  it('başka cihazın yedeği birleştirilince yeni günler store\'a eklenir', () => {
    useStore.getState().logMeasurement({ d: '2026-10-01', waist: 90 })
    const report = useStore.getState().mergeFrom(importBackup(exportBackup(withData())))
    expect(report.measurements).toEqual({ added: 1, identical: 0, conflicting: 1 })
    expect(useStore.getState().measurements).toEqual([
      { d: '2026-10-01', waist: 90 },
      { d: '2026-10-08', waist: 83 },
    ])
  })
})
