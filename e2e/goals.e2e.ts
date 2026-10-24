import { expect, test } from '@playwright/test'
import { defaultState, type Workout } from '../src/store/schema.ts'
import { BENCH, readState, seed } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000
const local = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Son 8 haftada her hafta tek tekrar, +1 kg: 56 gün önce 80 kg, bugün 88 kg (1RM = ağırlık). */
function history(): Workout[] {
  const now = Date.now()
  return [56, 49, 42, 35, 28, 21, 14, 7, 0].map((ago, i) => ({
    id: `w${i}`,
    d: local(now - ago * DAY),
    start: now - ago * DAY,
    name: 'A',
    entries: [{ exId: BENCH, sets: [{ w: 80 + i, r: 1, done: true }] }],
  }))
}

test('Analiz: geçmişi olan kullanıcı hedef ekler, ilerlemeyi ve tahmini tarihi görür', async ({ page }) => {
  const s = defaultState()
  s.workouts = history()
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')

  const card = page.locator('.card', { hasText: 'Kuvvet hedefleri' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: '+ Hedef ekle' }).click()

  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Şu ana kadarki en iyi tahmini 1RM: 88 kg')
  await sheet.getByLabel('Hedef 1RM').fill('100')
  // Haftada 1 kg ile 12 kg fark 12 haftada kapanır: hedef gün tam o gün.
  await sheet.getByLabel('Hedef tarih').fill(local(Date.now() + 84 * DAY))
  await sheet.getByRole('button', { name: 'Kaydet' }).click()
  await expect(sheet).toHaveCount(0)

  const row = card.locator('.goal-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Hedef 1RM 100 kg')
  await expect(row).toContainText('Son 8 haftanın en iyisi 88 / 100 kg')
  await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '88')
  await expect(row.locator('.goal-forecast')).toContainText('Tahmini varış')
  await expect(row.locator('.goal-forecast')).toContainText('zamanında (haftada +1 kg)')

  // Ana grafikte hedef çizgisi.
  await expect(page.locator('.card', { hasText: 'Egzersiz ilerlemesi' }).getByTestId('chart-target')).toContainText('Hedef 100 kg')
  await card.screenshot({ path: process.env.SHOT ?? 'test-results/goals.png' })

  // Kalıcı: yeniden açınca hedef durur; birim lb olunca gösterim çevrilir.
  const saved = await readState(page)
  expect(saved.goals).toMatchObject([{ exId: BENCH, target: 100 }])
  await page.reload()
  await expect(page.locator('.goal-row')).toContainText('Hedef 1RM 100 kg')

  // Düzenle: hedef tarihi öne çekilince "geride" olur.
  await page.locator('.goal-row').getByRole('button', { name: 'Düzenle' }).click()
  await page.getByRole('dialog').getByLabel('Hedef tarih').fill(local(Date.now() + 28 * DAY))
  await page.getByRole('dialog').getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.locator('.goal-forecast')).toContainText('hedef tarihten 8 hafta geride')

  // Sil ve geri al.
  await page.locator('.goal-row').getByRole('button', { name: 'Sil' }).click()
  await expect(page.locator('.goal-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.locator('.goal-row')).toHaveCount(1)
})

test('Analiz: ulaşılan hedef bir kez kutlanır, işareti kalır; egzersiz detayında hedef çizgisi', async ({ page }) => {
  const s = defaultState()
  s.workouts = history()
  s.goals = [{ id: 'g1', exId: BENCH, target: 85, by: local(Date.now() + 30 * DAY), created: local(Date.now() - 30 * DAY) }]
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')

  await expect(page.getByText('🎯 Hedefe ulaştın')).toBeVisible()
  const row = page.locator('.goal-row')
  await expect(row.locator('.badge')).toContainText('Ulaşıldı')
  await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  expect((await readState(page)).goals[0].done).toBe(local(Date.now() - 21 * DAY))

  await page.reload()
  await expect(page.locator('.goal-row .badge')).toContainText('Ulaşıldı')
  await expect(page.getByText('🎯 Hedefe ulaştın')).toHaveCount(0)

  await page.locator('.card', { hasText: 'Kişisel rekorlar' }).locator('.rec-row').first().click()
  await expect(page.getByRole('dialog').getByTestId('chart-target')).toContainText('Hedef 85 kg')
})

test('Analiz: veri yetersizse tarih uydurulmaz', async ({ page }) => {
  const s = defaultState()
  s.workouts = history().slice(-2)
  s.goals = [{ id: 'g1', exId: BENCH, target: 100, by: local(Date.now() + 60 * DAY), created: local(Date.now()) }]
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')
  await expect(page.locator('.goal-forecast')).toContainText('Tahmin için veri yetersiz: son 8 haftada 2 seans var')
  await expect(page.locator('.goal-forecast')).not.toContainText('Tahmini varış')
})
