import { expect, test } from '@playwright/test'
import { BENCH, readState, seed, stateWithRoutine } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000
const SQUAT = 'Barbell_Squat'

function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** İki egzersizde 4 normal + 2 belirgin düşük seans (son seans 1 gün önce, 2 gün arayla). */
function decliningState(): string {
  const s = stateWithRoutine()
  const now = Date.now()
  s.workouts = [100, 100, 100, 100, 85, 85].map((w, i) => {
    const t = now - (1 + (5 - i) * 2) * DAY
    return {
      id: `d${i}`,
      d: dayOf(t),
      start: t,
      end: t + 3_600_000,
      name: 'Eski',
      entries: [BENCH, SQUAT].map((exId) => ({ exId, sets: [{ w, r: 5, done: true }] })),
    }
  })
  // Yedek hatırlatması bu testin konusu değil: yeni yedek almış gibi davran.
  s.settings.lastBackupAt = now
  return JSON.stringify(s)
}

test('toparlanma molası önerisi görünür; "Şimdi değil" 7 gün susturur', async ({ page }) => {
  await seed(page, decliningState())
  await page.goto('./#/')

  const card = page.locator('.card.banner').filter({ hasText: 'Toparlanma molası?' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Barbell Bench Press - Medium Grip')
  await expect(card).toContainText('Barbell Squat')
  await expect(card).toContainText('%40–50')

  await card.getByRole('button', { name: 'Şimdi değil' }).click()
  await expect(card).toBeHidden()

  const until = (await readState(page)).settings.deloadSnoozedUntil
  expect(until).toBeGreaterThan(Date.now() + 6.9 * DAY)
  expect(until).toBeLessThan(Date.now() + 7.1 * DAY)

  await page.reload()
  await expect(page.getByText('Toparlanma molası?')).toBeHidden()
})

test('düşüş yoksa öneri görünmez', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/')
  await expect(page.getByText('Toparlanma molası?')).toBeHidden()
})
