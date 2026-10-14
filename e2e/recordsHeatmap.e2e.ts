import { expect, test } from '@playwright/test'
import { defaultState, type Workout } from '../src/store/schema.ts'
import { seed } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000
const local = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function history(): Workout[] {
  const now = Date.now()
  const sets = (w: number, n: number) => Array.from({ length: n }, () => ({ w, r: 5, done: true }))
  return [
    // 60 gün önce 100 kg x 5: eski rekor; 3 gün önce 105 kg x 5: yeni rekor (rozet çıkar).
    { id: 'w0', d: local(now - 60 * DAY), start: now - 60 * DAY, name: 'A', entries: [{ exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: sets(100, 3) }] },
    { id: 'w1', d: local(now - 3 * DAY), start: now - 3 * DAY, name: 'A', entries: [{ exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: sets(105, 12) }] },
    // 40 gün önceki rekor: rozetsiz.
    { id: 'w2', d: local(now - 40 * DAY), start: now - 40 * DAY, name: 'B', entries: [{ exId: 'Barbell_Curl', sets: sets(30, 2) }] },
  ]
}

test('Analiz: rekorlar son 30 gündeki rekoru rozetle gösterir ve satır detayı açar', async ({ page }) => {
  const s = defaultState()
  s.workouts = history()
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')

  const card = page.locator('.card', { hasText: 'Kişisel rekorlar' })
  await expect(card).toBeVisible()
  await expect(card.locator('.rec-row')).toHaveCount(2)
  // En yeni rekor önce: bench press 3 gün önce, curl 40 gün önce.
  await expect(card.locator('.rec-row').first()).toContainText('1RM ≈ 122,5 kg · 105 kg×5')
  await expect(card.locator('.rec-new')).toHaveCount(1)
  await expect(card.locator('.rec-row').first().locator('.rec-new')).toContainText('Son 30 günde yeni')
  await expect(card).toContainText('son 30 günde 1 yeni rekor')
  await expect(card.getByRole('button', { name: /Tümünü gör/ })).toHaveCount(0)

  await card.locator('.rec-row').first().click()
  await expect(page.getByRole('dialog')).toContainText('en iyi tahmini 1RM')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Analiz: sıklık ısı haritası günleri etiketler, ay özetini yazar ve taşmaz', async ({ page }) => {
  const s = defaultState()
  s.workouts = history()
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')

  const card = page.locator('.card', { hasText: 'Antrenman sıklığı' })
  await expect(card).toBeVisible()
  await expect(card).toContainText(/Bu ay \d+ antrenman · geçen ay \d+/)

  // 3 gün önceki 12 set: 10-19 kademesi (heat-l2) ve tarih/set sayısı etiketi.
  const day = local(Date.now() - 3 * DAY)
  const [y, , d] = day.split('-').map(Number)
  const cell = card.locator('.heat-grid .heat-l2')
  await expect(cell).toHaveCount(1)
  await expect(cell).toHaveAttribute('aria-label', new RegExp(`${d} .* ${y}: 12 set`))
  await expect(card.locator('.heat-today')).toHaveCount(1)
  await expect(card.locator('.heat-legend')).toContainText('20+')

  // Hücreler klavyeyle odaklanılamaz: Tab ızgaranın içinde takılmaz.
  await expect(card.locator('.heat-cell[tabindex], .heat-cell button')).toHaveCount(0)

  // Dar telefonda (320px) sayfa yatay kaymaz.
  await page.setViewportSize({ width: 320, height: 640 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await card.screenshot({ path: process.env.SHOT ?? 'test-results/frequency-heatmap.png' })
})

test('Analiz: antrenman yoksa rekor ve sıklık kartları görünmez', async ({ page }) => {
  await page.goto('./#/stats')
  await expect(page.getByText('Performans analizi')).toBeVisible()
  await expect(page.locator('.card', { hasText: 'Kişisel rekorlar' })).toHaveCount(0)
  await expect(page.locator('.card', { hasText: 'Antrenman sıklığı' })).toHaveCount(0)
})
