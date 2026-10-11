import { expect, test } from '@playwright/test'
import pkg from '../package.json' with { type: 'json' }

test('Ayarlar package.json sürümünü gösterir', async ({ page }) => {
  await page.goto('./#/settings')
  await expect(page.getByText(`monk-mode v${pkg.version}`)).toBeVisible()
})
