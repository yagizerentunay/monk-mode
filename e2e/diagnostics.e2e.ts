import { expect, test } from '@playwright/test'
import pkg from '../package.json' with { type: 'json' }

test('Ayarlar > Tanılama: satırlar, test sesi ve kopyalanan rapor', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./#/settings')
  const card = page.locator('.diagnostics')
  await card.getByRole('button', { name: 'Tanılamayı göster' }).click()

  await expect(card.locator('li', { hasText: 'Sürüm' })).toContainText(`v${pkg.version}`)
  for (const label of ['Çevrimdışı çalışma', 'Kalıcı depolama', 'Kayıtlı veri', 'Otomatik kopyalar', 'Dosya paylaşımı', 'Dinlenme sesi', 'Ekranı açık tutma']) {
    await expect(card.locator('li', { hasText: label })).toBeVisible()
  }

  // Test sesi bir dokunuşla çalınır; ardından ses bağlamı hazır görünmeli.
  await card.getByRole('button', { name: 'Test sesi çal' }).click()
  await expect(card.locator('li', { hasText: 'Dinlenme sesi' })).toContainText('hazır')

  await card.getByRole('button', { name: 'Raporu kopyala' }).click()
  await expect(card.getByText('Rapor kopyalandı.')).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/^monk-mode tanılama · /)
  expect(text).toContain(`Sürüm: v${pkg.version}`)
  expect(text).toContain('Tarayıcı: ')
  await card.screenshot({ path: process.env.SHOT ?? 'test-results/diagnostics.png' })
})
