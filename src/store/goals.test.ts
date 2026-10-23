import { beforeEach, describe, expect, it } from 'vitest'
import { fingerprint } from '../lib/backupReminder.ts'
import { exportBackup, importBackup, importBackupWithReport } from './backup.ts'
import { migrate } from './migrate.ts'
import { defaultState, type StrengthGoal, type Workout } from './schema.ts'
import { snapshot, useStore } from './useStore.ts'

const goal = (over: Partial<StrengthGoal> = {}): StrengthGoal => ({
  id: 'g1',
  exId: 'bench',
  target: 100,
  by: '2027-03-01',
  created: '2026-10-01',
  ...over,
})

const wk = (id: string, d: string, w: number): Workout => ({
  id,
  d,
  start: 1,
  name: 'A',
  entries: [{ exId: 'bench', sets: [{ w, r: 1, done: true }] }],
})

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('store: hedefler', () => {
  it('ekler, aynı kimlikte yerinde değiştirir, siler ve geri alır', () => {
    const s = useStore.getState()
    s.saveGoal(goal())
    s.saveGoal(goal({ id: 'g2', exId: 'squat' }))
    s.saveGoal(goal({ target: 110 }))
    expect(useStore.getState().goals.map((g) => [g.id, g.target])).toEqual([
      ['g1', 110],
      ['g2', 100],
    ])
    const removed = useStore.getState().goals[0]
    s.deleteGoal('g1')
    expect(useStore.getState().goals.map((g) => g.id)).toEqual(['g2'])
    s.restoreGoal(removed, 0)
    s.restoreGoal(removed, 0)
    expect(useStore.getState().goals.map((g) => g.id)).toEqual(['g1', 'g2'])
  })

  it('settleGoals ulaşılan hedefi bir kez işaretler ve döner', () => {
    const s = useStore.getState()
    s.saveGoal(goal())
    s.addWorkout(wk('w1', '2026-10-10', 95))
    expect(s.settleGoals()).toEqual([])
    s.addWorkout(wk('w2', '2026-10-20', 102.5))
    const reached = useStore.getState().settleGoals()
    expect(reached).toEqual([{ ...goal(), done: '2026-10-20' }])
    expect(useStore.getState().goals[0].done).toBe('2026-10-20')
    // İkinci çağrıda kutlanacak yeni hedef yok.
    expect(useStore.getState().settleGoals()).toEqual([])
  })

  it('snapshot hedefleri içerir', () => {
    useStore.getState().saveGoal(goal())
    expect(snapshot(useStore.getState()).goals).toEqual([goal()])
  })
})

describe('yedek: hedefler', () => {
  it('dışa aktarılan yedek hedefleri aynen geri yükler', () => {
    const state = { ...defaultState(), goals: [goal(), goal({ id: 'g2', done: '2026-10-20' })] }
    expect(importBackup(exportBackup(state))).toEqual(state)
  })

  it('hedefi olmayan eski yedek boş listeyle açılır', () => {
    const { goals: _goals, ...old } = defaultState()
    expect(importBackup(JSON.stringify({ app: 'monk-mode', state: old })).goals).toEqual([])
  })

  it('bozuk hedefler atılır ve sayılır; geçerli alanlar aynen kalır', () => {
    const { state, report } = importBackupWithReport(
      JSON.stringify({
        app: 'monk-mode',
        state: {
          goals: [
            goal(),
            goal({ id: '' }),
            goal({ target: -5 }),
            goal({ target: 5000 }),
            goal({ by: '2026-02-30' }),
            { ...goal(), created: undefined },
            'x',
            { ...goal({ id: 'g9' }), done: 'dün', extra: 1 },
          ],
        },
      }),
    )
    expect(state.goals).toEqual([goal(), goal({ id: 'g9' })])
    expect(report.dropped.goal).toBe(6)
    expect(migrate({ goals: 'x' }).goals).toEqual([])
  })

  it('parmak izi: hedef yoksa eski izle aynı, hedef eklenince değişir', () => {
    const s = defaultState()
    const { goals: _goals, ...noGoals } = s
    expect(fingerprint(s)).toBe(fingerprint(noGoals))
    expect(fingerprint({ ...s, goals: [goal()] })).not.toBe(fingerprint(s))
    expect(fingerprint({ ...s, goals: [goal()] })).not.toBe(fingerprint({ ...s, goals: [goal({ target: 105 })] }))
  })
})

describe('store: birleştirme', () => {
  it('mergeFrom gelen hedefleri ekler', () => {
    useStore.getState().saveGoal(goal())
    const report = useStore.getState().mergeFrom({ ...defaultState(), goals: [goal(), goal({ id: 'g2', exId: 'squat' })] })
    expect(report.goals).toEqual({ added: 1, identical: 1, conflicting: 0 })
    expect(useStore.getState().goals.map((g) => g.id)).toEqual(['g1', 'g2'])
  })
})
