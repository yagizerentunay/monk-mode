import { expect, test, type Page } from '@playwright/test'
import { defaultState, type SetEntry, type State, type Workout } from '../src/store/schema.ts'
import { seed } from './seed.ts'

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const DAY = 24 * 60 * 60 * 1000

/** Yerel gün, YYYY-MM-DD (uygulamanın dayString'i ile aynı). */
const localDay = (ms: number): string => new Date(ms).toLocaleDateString('sv-SE')

/** `daysAgo` gün önce başlayan, `minutes` süren bench seansı. */
function session(i: number, daysAgo: number, sets: SetEntry[], minutes = 60): Workout {
  const start = Date.now() - daysAgo * DAY
  return {
    id: `w${i}`,
    d: localDay(start),
    start,
    end: start + minutes * 60_000,
    routineId: 'r1',
    name: 'E2E Push',
    entries: [{ exId: BENCH, sets }],
  }
}

/** 60 kg × 5 hedefli tek egzersizli rutin ve verilen geçmiş. */
function state(workouts: Workout[], today = false): State {
  const s = defaultState()
  s.routines = [{ id: 'r1', name: 'E2E Push', ex: [{ exId: BENCH, sets: 2, reps: 5, repsMax: 5, weight: 60, prog: 'off', inc: 2.5 }] }]
  if (today) s.week = { ...s.week, [new Date().getDay()]: 'r1' }
  s.workouts = workouts
  return s
}

const sets = (w: number, r = 5): SetEntry[] => [{ w, r, done: true }]

async function start(page: Page, s: State): Promise<void> {
  await seed(page, JSON.stringify(s))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
}

test('ana sayfa rutinin genelde ne kadar sürdüğünü gösterir, az geçmişte göstermez', async ({ page }) => {
  await seed(page, JSON.stringify(state([session(0, 9, sets(50), 55), session(1, 6, sets(50), 65)], true)))
  await page.goto('./#/')
  await expect(page.getByText('genelde ~60 dk')).toBeVisible()

  await seed(page, JSON.stringify(state([session(0, 6, sets(50), 65)], true)))
  await page.goto('./#/')
  await expect(page.getByText('E2E Push').first()).toBeVisible()
  await expect(page.getByText(/genelde/)).toHaveCount(0)
})

test('set tamamlanınca tahmini 1RM rekoru kırıldıysa bildirim çıkar', async ({ page }) => {
  await start(page, state([session(0, 6, sets(40))]))
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(page.getByRole('status')).toContainText('Yeni rekor: Barbell Bench Press · tahmini 1RM 70 kg')
})

test('rekor kırılmadıysa ya da geçmiş yoksa bildirim çıkmaz', async ({ page }) => {
  await start(page, state([session(0, 6, sets(80))]))
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('plato notundan egzersiz değiştirme sayfası açılır; set tamamlanınca düğme kalkar', async ({ page }) => {
  const plateau = [session(0, 20, sets(60)), session(1, 15, sets(60)), session(2, 10, sets(60)), session(3, 5, sets(60))]
  await start(page, state(plateau))
  const note = page.getByRole('note').filter({ hasText: 'Plato' })
  await expect(note).toBeVisible()
  await note.getByRole('button', { name: 'Hareketi değiştir' }).click()
  await expect(page.getByRole('dialog', { name: 'Egzersizi değiştir' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(note.getByRole('button', { name: 'Hareketi değiştir' })).toHaveCount(0)
})
