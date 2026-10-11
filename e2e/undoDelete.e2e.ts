import { expect, test } from '@playwright/test'
import { readState, seed, stateWithRoutine } from './seed.ts'

/** İki rutinli, Salı'ya atanmış, geçmişinde iki antrenman olan örnek veri. */
function stateWithHistory(): string {
  const s = stateWithRoutine()
  s.routines.push({ id: 'r-pull', name: 'E2E Pull', ex: s.routines[0].ex })
  s.week = { 2: 'r-push', 4: 'r-pull' }
  const day = (d: string, start: number, name: string) => ({ id: `w-${name}`, d, start, end: start + 3_600_000, name, entries: [] })
  s.workouts = [day('2026-09-01', 1_788_000_000_000, 'Eski A'), day('2026-09-08', 1_788_600_000_000, 'Eski B')]
  return JSON.stringify(s)
}

test('geçmiş antrenman silinir, Geri al ile yerine döner ve otomatik kopya alınır', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await seed(page, stateWithHistory())

  await page.goto('./#/stats')
  await page.getByRole('button', { name: /Eski A/ }).click()
  await page.getByRole('button', { name: 'Sil', exact: true }).click()

  const toast = page.getByRole('status').filter({ hasText: 'Antrenman silindi' })
  await expect(toast).toBeVisible()
  await expect(page.getByRole('button', { name: /Eski A/ })).toHaveCount(0)
  expect((await readState(page)).workouts.map((w) => w.name)).toEqual(['Eski B'])

  await toast.getByRole('button', { name: 'Geri al' }).click()
  await expect(toast).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Eski A/ })).toBeVisible()
  expect((await readState(page)).workouts.map((w) => w.name)).toEqual(['Eski A', 'Eski B'])

  await page.goto('./#/settings')
  await expect(page.getByText('Antrenman silinmeden önce · 2 antrenman')).toBeVisible()
})

test('rutin silinir, Geri al ile gün ataması dahil döner ve otomatik kopya alınır', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await seed(page, stateWithHistory())

  await page.goto('./#/plan/r/r-push')
  await page.getByRole('button', { name: 'Rutini sil' }).click()

  await expect(page).toHaveURL(/#\/plan$/)
  const toast = page.getByRole('status').filter({ hasText: 'Rutin silindi' })
  await expect(toast).toBeVisible()
  let state = await readState(page)
  expect(state.routines.map((r) => r.id)).toEqual(['r-pull'])
  expect(state.week).toEqual({ 4: 'r-pull' })

  await toast.getByRole('button', { name: 'Geri al' }).click()
  await expect(toast).toHaveCount(0)
  state = await readState(page)
  expect(state.routines.map((r) => r.id)).toEqual(['r-push', 'r-pull'])
  expect(state.week).toEqual({ 2: 'r-push', 4: 'r-pull' })

  await page.goto('./#/settings')
  await expect(page.getByText('Rutin silinmeden önce · 2 antrenman')).toBeVisible()
})

test('devam eden antrenman atılır ve Geri al ile aktif döner', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await seed(page, stateWithHistory())

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  const before = (await readState(page)).active
  expect(before).not.toBeNull()

  await page.getByRole('button', { name: 'Menü' }).click()
  await page.getByRole('button', { name: 'Antrenmanı at' }).click()

  // Antrenman ekranı kalır (başlatıcıya döner); bildirim orada görünür.
  const toast = page.getByRole('status').filter({ hasText: 'Devam eden antrenman silindi' })
  await expect(toast).toBeVisible()
  await expect(page.getByText('Bir rutin seç')).toBeVisible()
  expect((await readState(page)).active).toBeNull()

  await toast.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.getByRole('heading', { name: 'E2E Push' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seti geri al' })).toHaveCount(1)
  expect((await readState(page)).active).toEqual(before)
})

test('bildirim klavyeyle erişilir ve kendiliğinden kapanır', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.clock.install()
  await seed(page, stateWithHistory())

  await page.goto('./#/plan/r/r-pull')
  await page.getByRole('button', { name: 'Rutini sil' }).click()
  const toast = page.getByRole('status').filter({ hasText: 'Rutin silindi' })
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'Geri al' }).focus()
  await page.keyboard.press('Enter')
  await expect(toast).toHaveCount(0)
  expect((await readState(page)).routines.map((r) => r.id)).toEqual(['r-push', 'r-pull'])

  // Geri alınmazsa ~6 sn sonra kapanır.
  await page.goto('./#/plan/r/r-pull')
  await page.getByRole('button', { name: 'Rutini sil' }).click()
  await expect(toast).toBeVisible()
  await page.mouse.move(0, 0)
  await page.clock.runFor(5000)
  await expect(toast).toBeVisible()
  await page.clock.runFor(1500)
  await expect(toast).toHaveCount(0)
})
