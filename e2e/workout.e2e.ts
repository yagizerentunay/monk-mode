import { expect, test } from '@playwright/test'
import { readState, seed, stateWithRoutine } from './seed.ts'

test('antrenman bitirilir ve yeniden yüklemeden sonra geçmişte kalır', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()

  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await expect(complete).toHaveCount(2)
  await complete.first().click()
  await complete.first().click()
  await expect(page.getByRole('button', { name: 'Seti geri al' })).toHaveCount(2)

  await page.getByRole('button', { name: 'Bitir ✓' }).click()

  await page.reload()
  const state = await readState(page)
  expect(state.active).toBeNull()
  expect(state.workouts).toHaveLength(1)
  const [workout] = state.workouts
  expect(workout.name).toBe('E2E Push')
  expect(workout.entries[0].sets.filter((s) => s.done && !s.warmup)).toHaveLength(2)
  expect(workout.entries[0].sets[0]).toMatchObject({ w: 60, r: 5 })

  await page.goto('./#/')
  await expect(page.locator('.stat', { hasText: 'toplam' })).toContainText('01')
})

test('antrenman sayacı saniye saniye ilerler', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()

  const clock = page.locator('.wk-clock')
  await expect(clock).toHaveText(/^0:0\d$/)
  const first = await clock.textContent()
  await expect(clock).not.toHaveText(first ?? '', { timeout: 2500 })
})

test('hızlı yazıp hemen yenileyince son değer kaybolmaz (kısılmış kayıt kapanışta yazılır)', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()

  const field = page.getByRole('textbox', { name: /Set 1 ağırlık/ }).first()
  await field.fill('72.5')
  await field.blur()
  await page.reload()

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('monk_state_v1') ?? 'null'))
  expect(stored.active.entries[0].sets[0].w).toBe(72.5)
})
