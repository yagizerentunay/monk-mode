import { expect, test, type Page } from '@playwright/test'
import { defaultState, type State } from '../src/store/schema.ts'
import { BENCH, readState, seed, stateWithRoutine } from './seed.ts'

/** Türkçeye özgü harfler: İngilizce arayüzde görünen metinde olmamalı. */
const TURKISH = /[ğüşıöçĞÜŞİÖÇ]/

const tabBar = (page: Page) => page.locator('.tabbar nav')

test('Ayarlar > English: sekme çubuğu, Ana Sayfa ve Analiz İngilizce olur, yeniden yüklemede kalır', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(tabBar(page)).toContainText('Analiz')

  await page.goto('./#/settings')
  const english = page.getByRole('button', { name: 'English', exact: true })
  await english.click()
  await expect(english).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  expect((await readState(page)).settings.language).toBe('en')

  for (const label of ['Home', 'Plan', 'Start', 'Stats', 'Exercises']) {
    await expect(tabBar(page).getByRole('link', { name: label, exact: true })).toBeVisible()
  }

  await tabBar(page).getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.locator('.home-head .display')).toHaveText('TODAYGET STRONGER.')
  await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible()

  await tabBar(page).getByRole('link', { name: 'Stats', exact: true }).click()
  await expect(page.getByText('Performance analysis')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every setis a step.')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every setis a step.')
  await expect(tabBar(page).getByRole('link', { name: 'Home', exact: true })).toBeVisible()

  // Türkçeye dönüş de aynı yoldan: dil adları her dilde kendi adıyla yazılır.
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Türkçe', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ayarlar')
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
})

test.describe('cihaz dili İngilizce', () => {
  test.use({ locale: 'en-US' })

  test("varsayılan 'system' ayarıyla uygulama İngilizce açılır", async ({ page }) => {
    await seed(page, JSON.stringify(defaultState()))
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(tabBar(page).getByRole('link', { name: 'Home', exact: true })).toBeVisible()
    await expect(page.locator('.home-head .display')).toHaveText('TODAYGET STRONGER.')

    await page.goto('./#/settings')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
    // Dil satırındaki "System" seçili (tema satırında da bir "System" var; ilki temadır).
    const system = page.getByRole('button', { name: 'System', exact: true })
    await expect(system).toHaveCount(2)
    await expect(system.nth(1)).toHaveAttribute('aria-pressed', 'true')
    expect((await readState(page)).settings.language).toBe('system')
  })
})

/** İngilizce tarama için birkaç ekranı dolduran veri: rutin, iki antrenman, tartı, ölçü, hedef ve blok. */
function richState(): State {
  const base = stateWithRoutine()
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const workout = (id: string, d: string, w: number) => ({
    id,
    d,
    start: Date.parse(`${d}T10:00:00`),
    end: Date.parse(`${d}T10:45:00`),
    routineId: 'r-push',
    name: 'E2E Push',
    entries: [{ exId: BENCH, sets: [{ w, r: 5, done: true, rir: 2 }, { w, r: 5, done: true }] }],
  })
  return {
    ...base,
    settings: { ...base.settings, language: 'en' },
    week: { 1: 'r-push', 3: 'r-push', 5: 'r-push' },
    workouts: [workout('w1', day(8), 60), workout('w2', day(2), 62.5)],
    bodyweight: [
      { d: day(9), w: 80.4 },
      { d: day(1), w: 79.8 },
    ],
    measurements: [{ d: day(1), waist: 82.5, fat: 15 }],
    goals: [{ id: 'g1', exId: BENCH, target: 100, by: day(-60), created: day(10) }],
    block: { id: 'b1', start: day(3), weeks: 5, deload: 5 },
  }
}

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText)
}

test('İngilizce tarama: ana sekmelerde görünen metinde Türkçe harf yok', async ({ page }) => {
  await seed(page, JSON.stringify(richState()))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const check = async (route: string, ready: () => Promise<void>) => {
    await page.goto(`./#${route}`)
    await ready()
    const text = await visibleText(page)
    // Dil seçeneği kendi adıyla ("Türkçe") yazılır; geri kalan her şey İngilizce olmalı.
    const lines = text.split('\n').filter((l) => TURKISH.test(l) && l.trim() !== 'Türkçe')
    expect(lines, `${route} ekranında Türkçe metin`).toEqual([])
  }

  await check('/', () => expect(page.getByText("Today's workout").or(page.getByText('Rest day'))).toBeVisible())
  await check('/plan', () => expect(page.getByText('Weekly plan')).toBeVisible())
  await check('/stats', () => expect(page.getByText('Personal records')).toBeVisible())
  await check('/library', () => expect(page.getByPlaceholder('Search exercises…')).toBeVisible())
  await check('/settings', () => expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings'))

  // Antrenman ekranı: başlatıcı ve devam eden seans.
  await check('/workout', () => expect(page.getByText('Pick a routine')).toBeVisible())
  await page.getByRole('button', { name: /E2E Push/ }).click()
  await expect(page.getByText('Last session:').first()).toBeVisible()
  const workoutText = (await visibleText(page)).split('\n').filter((l) => TURKISH.test(l))
  expect(workoutText, 'antrenman ekranında Türkçe metin').toEqual([])

  // Kütüphane detayı: yönergeler İngilizce.
  await page.goto('./#/library')
  await page.getByPlaceholder('Search exercises…').fill('Barbell Bench Press')
  await page.locator('.exrow').first().click()
  await expect(page.getByRole('button', { name: 'Fix muscles' })).toBeVisible()
  const steps = await page.locator('.sheet ol li').allInnerTexts()
  expect(steps.length).toBeGreaterThan(0)
  expect(steps.filter((s) => TURKISH.test(s))).toEqual([])
})
