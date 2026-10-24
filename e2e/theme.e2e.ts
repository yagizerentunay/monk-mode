import { expect, test, type Page } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { readState, seed } from './seed.ts'

const DARK_BG = 'rgb(17, 19, 21)'
const LIGHT_BG = 'rgb(243, 239, 233)'

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute('content')

test.describe('tema: koyu cihaz', () => {
  test.use({ colorScheme: 'dark' })

  test('tema seçimi data-theme ve renkleri değiştirir, yeniden yüklemede kalır', async ({ page }) => {
    await seed(page, JSON.stringify(defaultState()))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system')
    expect(await bodyBg(page)).toBe(DARK_BG)

    await page.goto('./#/settings')
    const light = page.getByRole('button', { name: 'Açık', exact: true })
    await light.click()
    await expect(light).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bodyBg(page)).toBe(LIGHT_BG)
    expect(await themeColor(page)).toBe('#f3efe9')
    expect((await readState(page)).settings.theme).toBe('light')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bodyBg(page)).toBe(LIGHT_BG)
    await expect(page.getByRole('button', { name: 'Açık', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Koyu', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await bodyBg(page)).toBe(DARK_BG)
    expect(await themeColor(page)).toBe('#111315')
  })

  test('açılış betiği temayı uygulama paketi yüklenmeden uygular (yanıp sönme yok)', async ({ page }) => {
    await seed(page, JSON.stringify({ ...defaultState(), settings: { ...defaultState().settings, theme: 'light' } }))
    // Uygulama paketini engelle: React hiç çalışmasa da ilk boyama açık temada olmalı.
    await page.route(/\/assets\/.*\.js$/, (route) => route.abort())
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await bodyBg(page)).toBe(LIGHT_BG)
    expect(await themeColor(page)).toBe('#f3efe9')
  })
})

test.describe('tema: açık cihaz', () => {
  test.use({ colorScheme: 'light' })

  test("'Sistem' cihaz açıkken açık temaya, 'Koyu' seçilince koyuya geçer", async ({ page }) => {
    await seed(page, JSON.stringify(defaultState()))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system')
    expect(await bodyBg(page)).toBe(LIGHT_BG)
    expect(await themeColor(page)).toBe('#f3efe9')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => bodyBg(page)).toBe(DARK_BG)
    await expect.poll(() => themeColor(page)).toBe('#111315')

    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('./#/settings')
    await page.getByRole('button', { name: 'Koyu', exact: true }).click()
    expect(await bodyBg(page)).toBe(DARK_BG)
  })
})
