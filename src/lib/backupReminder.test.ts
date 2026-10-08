import { describe, expect, it } from 'vitest'
import { defaultState, type State } from '../store/schema.ts'
import { backupStatus, fingerprint } from './backupReminder.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 20, 12)

function state(over: Partial<State> = {}, settings: Partial<State['settings']> = {}): State {
  const base = defaultState()
  return { ...base, ...over, settings: { ...base.settings, ...settings } }
}
const wk = (id: string, start: number) => ({ id, d: '2026-10-01', start, name: 't', entries: [] })

describe('veri parmak izi', () => {
  it('aynı veri aynı izi verir, değişince izi değiştirir', () => {
    const a = state({ workouts: [wk('a', 1)] })
    expect(fingerprint(a)).toBe(fingerprint(state({ workouts: [wk('a', 1)] })))
    expect(fingerprint(a)).not.toBe(fingerprint(state({ workouts: [wk('a', 1), wk('b', 2)] })))
    expect(fingerprint(a)).not.toBe(
      fingerprint(state({ workouts: [wk('a', 1)], bodyweight: [{ d: '2026-10-01', w: 80 }] })),
    )
  })

  it('ayarlara ve devam eden antrenmana duyarsızdır', () => {
    const a = state({ workouts: [wk('a', 1)] })
    const b = state({ workouts: [wk('a', 1)], active: wk('x', 5) }, { unit: 'lb', backupRemindDays: 7 })
    expect(fingerprint(a)).toBe(fingerprint(b))
  })
})

describe('yedek hatırlatma', () => {
  it('veri yokken ya da yalnız rutin varken hatırlatmaz', () => {
    expect(backupStatus(state(), NOW).due).toBe(false)
    const onlyRoutine = state({ routines: [{ id: 'r', name: 'x', ex: [] }] })
    expect(backupStatus(onlyRoutine, NOW)).toMatchObject({ due: false, days: null })
  })

  it('hiç yedek yoksa süreyi en eski kayıttan sayar', () => {
    const young = state({ workouts: [wk('a', NOW - 5 * DAY)] })
    expect(backupStatus(young, NOW)).toMatchObject({ due: false, never: true, days: 5 })
    const old = state({ workouts: [wk('a', NOW - 20 * DAY), wk('b', NOW - DAY)] })
    expect(backupStatus(old, NOW)).toMatchObject({ due: true, never: true, days: 20 })
  })

  it('yedeğin üzerinden süre geçmiş ve veri değişmişse hatırlatır', () => {
    const data = { workouts: [wk('a', NOW - 30 * DAY)] }
    const saved = fingerprint(state(data))
    const changed = state(
      { workouts: [...data.workouts, wk('b', NOW - DAY)] },
      { lastBackupAt: NOW - 15 * DAY, lastBackupHash: saved },
    )
    expect(backupStatus(changed, NOW)).toMatchObject({ due: true, dirty: true, never: false, days: 15 })
  })

  it('veri yedekten beri değişmediyse süre geçse de hatırlatmaz', () => {
    const s = state({ workouts: [wk('a', 1)] })
    const clean = state(
      { workouts: [wk('a', 1)] },
      { lastBackupAt: NOW - 90 * DAY, lastBackupHash: fingerprint(s) },
    )
    expect(backupStatus(clean, NOW)).toMatchObject({ due: false, dirty: false, days: 90 })
  })

  it('süre dolmadıysa hatırlatmaz (14 gün varsayılan, sınırda hatırlatır)', () => {
    const mk = (days: number) =>
      state({ workouts: [wk('a', 1)] }, { lastBackupAt: NOW - days * DAY, lastBackupHash: 'eski' })
    expect(backupStatus(mk(13), NOW).due).toBe(false)
    expect(backupStatus(mk(14), NOW).due).toBe(true)
  })

  it('kapalıyken ve ertelenmişken hatırlatmaz, erteleme bitince yine hatırlatır', () => {
    const base = { workouts: [wk('a', 1)] }
    const at = { lastBackupAt: NOW - 40 * DAY, lastBackupHash: 'eski' }
    expect(backupStatus(state(base, { ...at, backupRemindDays: 0 }), NOW).due).toBe(false)
    expect(backupStatus(state(base, { ...at, backupSnoozedUntil: NOW + DAY }), NOW).due).toBe(false)
    expect(backupStatus(state(base, { ...at, backupSnoozedUntil: NOW - 1 }), NOW).due).toBe(true)
  })

  it('yalnız kilo kaydı olsa da hatırlatır', () => {
    const bw = state({ bodyweight: [{ d: '2026-09-01', w: 80 }] })
    expect(backupStatus(bw, NOW)).toMatchObject({ due: true, never: true })
  })
})
