import { expect, test } from '@playwright/test'
import { readState, seed, stateWithRoutine } from './seed.ts'

test('service worker önbelleğiyle çevrimdışı açılır, veri ve egzersizler yerinde', async ({ page, context }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))

  // Service worker kurulup sayfayı kontrol edene ve egzersiz verisi önbelleğe girene kadar bekle.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const name of await caches.keys()) {
          const cache = await caches.open(name)
          if ((await cache.keys()).some((r) => r.url.endsWith('/data/exercises.json'))) return true
        }
        return false
      }),
    )
    .toBe(true)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('link', { name: 'Ana', exact: true })).toBeVisible()
  expect((await readState(page)).routines.map((r) => r.name)).toEqual(['E2E Push'])

  // Egzersiz listesi de önbellekten gelir: arama sonucu çıkmalı.
  await page.goto('./#/library')
  await page.getByPlaceholder('Egzersiz ara…').fill('bench press')
  const bench = page.locator('.exname', { hasText: 'Barbell Bench Press - Medium Grip' }).first()
  await expect(bench).toBeVisible()
  // Talimatlar ayrı dosyada; o da önbellekten gelmeli.
  await bench.click()
  await expect(page.locator('ol li').first()).toBeVisible()

  // Ayrı parçalara bölünmüş ekranlar da önbellekten gelmeli (çevrimiçiyken hiç açılmadılar).
  for (const [hash, text] of [
    ['#/plan', 'Haftalık program'],
    ['#/stats', 'Performans analizi'],
    ['#/settings', 'monk-mode v'],
  ] as const) {
    await page.goto('./' + hash)
    await expect(page.locator('main.app').filter({ hasText: text }).first()).toBeVisible()
  }
})

test('manifest ikonları ayrı any ve maskable; dosyalar sunuluyor', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json()
  const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose)
  expect(purposes).not.toContain('any maskable')
  expect(purposes).toContain('maskable')
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, new URL(href!, page.url())).href)
    expect(res.ok(), icon.src).toBe(true)
  }
})
