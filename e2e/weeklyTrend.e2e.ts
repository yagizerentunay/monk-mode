import { expect, test } from '@playwright/test'
import { defaultState, type Workout } from '../src/store/schema.ts'
import { seed } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000
const local = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('Analiz: haftalık toplam kartı bu haftayı ve ölçü seçimini gösterir', async ({ page }) => {
  const s = defaultState()
  const now = Date.now()
  s.workouts = [21, 14, 7, 0].map((ago, i): Workout => ({
    id: `w${i}`,
    d: local(now - ago * DAY),
    start: now - ago * DAY,
    name: 'A',
    entries: [{ exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ w: 60, r: 5, done: true }, { w: 60, r: 5, done: true }, { w: 60, r: 5, done: true }] }],
  }))
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')

  const card = page.locator('.card', { hasText: 'Haftalık toplam' })
  await expect(card).toBeVisible()
  await expect(card.locator('.statbig')).toContainText('3')
  await expect(card.locator('.statbig')).toContainText('set · bu hafta')
  await expect(card).toContainText('Önceki 4 haftanın ortalaması: 3 set')
  await expect(card.locator('svg rect')).toHaveCount(12)

  await card.getByRole('button', { name: 'Hacim' }).click()
  await expect(card.locator('.statbig')).toContainText('900')
  await expect(card.locator('.statbig')).toContainText('kg · bu hafta')
  await card.screenshot({ path: process.env.SHOT ?? 'test-results/weekly-trend.png' })
})

test('Analiz: hiç antrenman yoksa haftalık kart görünmez', async ({ page }) => {
  await page.goto('./#/stats')
  await expect(page.getByText('Performans analizi')).toBeVisible()
  await expect(page.locator('.card', { hasText: 'Haftalık toplam' })).toHaveCount(0)
})
