import { expect, test, type Page } from '@playwright/test'
import { defaultState, type SetEntry, type State, type Workout } from '../src/store/schema.ts'
import { seed } from './seed.ts'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const DAY = 24 * 60 * 60 * 1000

/** 60 kg × 5 tekrar hedefli (çift ilerleme 5–8) rutin ve verilen geçmiş seanslar. */
function state(sessions: SetEntry[][], rule?: 'fast'): State {
  const s = defaultState()
  if (rule) s.settings.progressionRule = rule
  s.routines = [
    { id: 'r1', name: 'E2E Push', ex: [{ exId: BENCH, sets: 2, reps: 5, repsMax: 8, weight: 60, prog: 'double', inc: 2.5 }] },
  ]
  s.workouts = sessions.map((sets, i): Workout => {
    const start = Date.now() - (sessions.length - i) * 3 * DAY
    return { id: `w${i}`, d: new Date(start).toISOString().slice(0, 10), start, end: start + 3_600_000, routineId: 'r1', name: 'E2E Push', entries: [{ exId: BENCH, sets }] }
  })
  return s
}

const top = (rir?: number): SetEntry[] => [
  { w: 60, r: 8, done: true, ...(rir !== undefined ? { rir } : {}) },
  { w: 60, r: 8, done: true, ...(rir !== undefined ? { rir } : {}) },
]

async function start(page: Page, s: State): Promise<void> {
  await seed(page, JSON.stringify(s))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
}

test('temkinli kural: iki seans üst sınır + RIR 2 → artış ve gerekçesi görünür', async ({ page }) => {
  await start(page, state([top(2), top(3)]))
  await expect(page.getByText('Ağırlık artırıldı: iki seans üst sınırda kaldın')).toBeVisible()
  await expect(page.locator('.extarget')).toContainText('62,5')
})

test('temkinli kural: tek seans üst sınırda → ağırlık aynı, onay seansı istenir', async ({ page }) => {
  await start(page, state([top(2)]))
  await expect(page.getByText('Bir seans daha üst sınırda kalırsan ağırlık artar')).toBeVisible()
  await expect(page.locator('.extarget')).toContainText('60')
})

test('temkinli kural: RIR girilmemişse artış yok ve RIR istenir', async ({ page }) => {
  await start(page, state([top(), top()]))
  await expect(page.getByText('Ağırlık artışı için setlere RIR gir (en az 2)')).toBeVisible()
})

test('hızlı kural: tek seans üst sınır yeter', async ({ page }) => {
  await start(page, state([top()], 'fast'))
  await expect(page.getByText('Ağırlık artırıldı: geçen seans üst sınırdaydın')).toBeVisible()
})
