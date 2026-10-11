import { expect, test } from '@playwright/test'

test('sunucuda yeni derleme varsa bant çıkar, yenileyince güncel sürüme geçer', async ({ page }) => {
  // Yayında yeni bir derleme varmış gibi: version.json başka bir giriş betiği bildirir.
  await page.route('**/version.json', (route) =>
    route.fulfill({ json: { version: '9.9.9', entry: 'assets/index-yeni.js' } }),
  )
  await page.goto('./')
  await expect(page.getByText('Yeni sürüm hazır (v9.9.9)')).toBeVisible()

  await page.unroute('**/version.json')
  const checked = page.waitForResponse('**/version.json')
  await page.getByRole('button', { name: 'Yenile' }).click()
  await checked
  await expect(page.getByText('Yeni sürüm hazır')).toBeHidden()
})

test('çalışan sürüm güncelse bant çıkmaz', async ({ page }) => {
  const checked = page.waitForResponse('**/version.json')
  await page.goto('./')
  const res = await checked
  expect(res.ok()).toBe(true)
  await page.waitForTimeout(300)
  await expect(page.getByText('Yeni sürüm hazır')).toBeHidden()
})

test('"Sonra" bandı kapatır', async ({ page }) => {
  await page.route('**/version.json', (route) => route.fulfill({ json: { version: '', entry: 'assets/index-yeni.js' } }))
  await page.goto('./')
  await page.getByRole('button', { name: 'Sonra' }).click()
  await expect(page.getByText('Yeni sürüm hazır')).toBeHidden()
})

test('service worker devredeyken version.json önbellekten değil ağdan gelir', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const checked = page.waitForResponse('**/version.json')
  await page.reload()
  expect((await checked).fromServiceWorker()).toBe(false)
})
