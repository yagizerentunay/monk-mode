import { expect, test } from '@playwright/test'
import { seed, stateWithRoutine } from './seed.ts'

test('CSP sayfada var ve uygulama gezilirken hiçbir ihlal olmuyor', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & { __csp?: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__csp!.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  await seed(page, JSON.stringify(stateWithRoutine()))
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("object-src 'none'")

  for (const hash of ['#/', '#/plan', '#/stats', '#/library', '#/settings']) {
    await page.goto('./' + hash)
    await page.locator('main.app').filter({ hasText: /./ }).first().waitFor()
  }
  // Egzersiz detayı (görsel ve talimatlar) ve antrenman ekranı.
  await page.goto('./#/library')
  await page.getByPlaceholder('Egzersiz ara…').fill('bench press')
  await page.locator('.exname', { hasText: 'Barbell Bench Press' }).first().click()
  await expect(page.locator('ol li').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()

  const violations = await page.evaluate(() => (window as typeof window & { __csp?: string[] }).__csp)
  expect(violations).toEqual([])
})
