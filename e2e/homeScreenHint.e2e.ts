import { expect, test, type Page } from '@playwright/test'
import { seed, stateWithRoutine } from './seed.ts'

function stateWithWorkout(): string {
  const s = stateWithRoutine()
  const at = Date.now() - 3_600_000
  s.workouts = [{ id: 'w1', d: new Date(at).toISOString().slice(0, 10), start: at, end: at + 1_800_000, name: 'Eski', entries: [] }]
  return JSON.stringify(s)
}

/** Sayfayı iPhone'daki Safari sekmesi gibi gösterir (ana ekran dışı). */
async function pretendIphone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      configurable: true,
    })
    Object.defineProperty(navigator, 'platform', { value: 'iPhone', configurable: true })
  })
}

test('iPhone sekmesinde kaydı olan kullanıcıya ana ekrana ekle önerisi çıkar; Anladım 30 gün susturur', async ({ page }) => {
  await pretendIphone(page)
  await seed(page, stateWithWorkout())

  await expect(page.getByText('Verini güvene al: ana ekrana ekle')).toBeVisible()
  await expect(page.getByText('Ana ekran uygulaması ayrı depolama kullanır')).toBeVisible()

  await page.getByRole('button', { name: 'Anladım' }).click()
  await expect(page.getByText('Verini güvene al: ana ekrana ekle')).toBeHidden()

  await page.reload()
  await expect(page.locator('.display')).toBeVisible()
  await expect(page.getByText('Verini güvene al: ana ekrana ekle')).toBeHidden()
})

test('iOS dışında ve kaydı yokken öneri çıkmaz', async ({ page }) => {
  await seed(page, stateWithWorkout())
  await expect(page.locator('.display')).toBeVisible()
  await expect(page.getByText('Verini güvene al: ana ekrana ekle')).toBeHidden()

  const fresh = await page.context().newPage()
  await pretendIphone(fresh)
  await seed(fresh, JSON.stringify(stateWithRoutine()))
  await expect(fresh.locator('.display')).toBeVisible()
  await expect(fresh.getByText('Verini güvene al: ana ekrana ekle')).toBeHidden()
})
