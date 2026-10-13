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
        { exId: 'Dumbbell_Bench_Press', sets: [{ w: 20, r: 8, done: true }] },
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
  await expect(names.filter({ hasText: 'Dumbbell Bench Press' })).toBeVisible()
  await expect(names.filter({ hasText: 'Barbell Curl' })).toBeVisible()
  await expect(names.filter({ hasText: 'Unknown_Move' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto('./#/library')
  await expect(page.getByText('85 egzersiz')).toBeVisible()
  await page.getByPlaceholder('Egzersiz ara…').fill('dumbbell bench press')
  await expect(page.getByText('0 egzersiz')).toBeVisible()

  await page.getByPlaceholder('Egzersiz ara…').fill('barbell curl')
  const thumb = page.locator('.exrow img.thumb').first()
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  expect(requests.filter((u) => u.includes('jsdelivr'))).toEqual([])
})
