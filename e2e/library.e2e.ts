import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { seed } from './seed.ts'

test('eski kimlikli geçmiş adıyla görünür, kütüphane yalnız kendi hareketlerini listeler', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))

  const s = defaultState()
  s.workouts = [
    {
      id: 'w1',
      d: '2026-10-01',
      start: Date.UTC(2026, 9, 1, 10),
      end: Date.UTC(2026, 9, 1, 11),
      name: 'E2E Eski',
      entries: [
        // free-exercise-db'den kalan kimlik: kütüphanede yok, eski kimlik tablosundan çözülür.
        { exId: 'Barbell_Deadlift', sets: [{ w: 20, r: 8, done: true }] },
        // Kütüphanede kalan kimlik.
        { exId: 'Barbell_Curl', sets: [{ w: 30, r: 8, done: true }] },
        // Hiçbir yerde olmayan kimlik: ham kimlik gösterilir, uygulama çökmez.
        { exId: 'Unknown_Move', sets: [{ w: 10, r: 8, done: true }] },
      ],
    },
  ]
  await seed(page, JSON.stringify(s))

  await page.goto('./#/stats')
  await page.locator('.exrow', { hasText: 'E2E Eski' }).click()
  const names = page.locator('.exname')
  await expect(names.filter({ hasText: 'Barbell Deadlift' })).toBeVisible()
  await expect(names.filter({ hasText: 'Barbell Curl' })).toBeVisible()
  await expect(names.filter({ hasText: 'Unknown_Move' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('./#/library')
  await expect(page.getByText('186 egzersiz')).toBeVisible()
  await page.getByPlaceholder('Egzersiz ara…').fill('barbell deadlift')
  await expect(page.getByText('0 egzersiz')).toBeVisible()

  await page.getByPlaceholder('Egzersiz ara…').fill('barbell curl')
  const thumb = page.locator('.exrow img.thumb').first()
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  expect(requests.filter((u) => u.includes('jsdelivr'))).toEqual([])
})

test('önbellekteki eski egzersiz listesi, ağdaki güncel liste varken kullanılmaz', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // Önbelleğe, görselleri artık olmayan eski bir liste koy (güncelleme sonrası gerçek senaryo).
  await page.evaluate(async () => {
    const url = new URL('data/exercises.json', document.baseURI).href
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      if ((await cache.keys()).some((r) => r.url === url)) {
        const stale = [{ id: 'eski', name: 'Eski Önbellek Kaydı', level: 'beginner', equipment: null, category: 'strength', primaryMuscles: ['chest'], secondaryMuscles: [], illustration: 'exercises/silinmis.webp', instructions: ['x'] }]
        await cache.put(url, new Response(JSON.stringify(stale), { headers: { 'content-type': 'application/json' } }))
      }
    }
  })

  await page.goto('./#/library')
  await page.reload()
  await expect(page.getByText('186 egzersiz')).toBeVisible()
  await expect(page.getByText('Eski Önbellek Kaydı')).toHaveCount(0)
})

test('görseli olmayan egzersizde hedef kasın referans çizimi küçük resim olur', async ({ page }) => {
  await page.goto('./#/library')
  await page.getByPlaceholder('Egzersiz ara…').fill('dumbbell bench press')
  const row = page.locator('.exrow', { hasText: 'Dumbbell Bench Press' }).first()
  const thumb = row.locator('img.thumb-muscle')
  await expect(thumb).toBeVisible()
  await expect(thumb).toHaveAttribute('src', /muscles\/chest\.png$/)
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  // Kendi görseli olan egzersizde kas çizimi kullanılmaz.
  await page.getByPlaceholder('Egzersiz ara…').fill('barbell curl')
  await expect(page.locator('.exrow img.thumb').first()).not.toHaveClass(/thumb-muscle/)
})
