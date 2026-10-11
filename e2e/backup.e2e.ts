import { expect, test, type Page } from '@playwright/test'
import { readState, seed, stateWithRoutine } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000

async function finishWorkout(page: Page): Promise<void> {
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await complete.first().click()
  await complete.first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
}

test('antrenman sonrası iç kopya alınır; sıfırlamadan sonra geri yüklenir', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await finishWorkout(page)

  await page.goto('./#/settings')
  await expect(page.getByText('Antrenman bitti · 1 antrenman')).toBeVisible()

  page.on('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Her şeyi sıfırla' }).click()
  expect((await readState(page)).workouts).toHaveLength(0)

  await page.getByRole('row').or(page.locator('.row')).filter({ hasText: 'Antrenman bitti' }).getByRole('button', { name: 'Geri yükle' }).click()
  await expect(page.getByText('Geri yüklendi: 1 antrenman.')).toBeVisible()
  expect((await readState(page)).workouts).toHaveLength(1)
  // Geri yüklemeden önceki (boş) hâl de kopyalandı.
  await expect(page.getByText('Geri yüklemeden önce · 0 antrenman')).toBeVisible()
})

/** Yedek zamanı gelmiş veri: 20 gün önce bir antrenman, hiç yedek yok (hatırlatma 14 gün). */
function dueState(): string {
  const s = stateWithRoutine()
  const old = Date.now() - 20 * DAY
  s.workouts = [{ id: 'old', d: new Date(old).toISOString().slice(0, 10), start: old, end: old + 3_600_000, name: 'Eski', entries: [] }]
  return JSON.stringify(s)
}

/** Paylaşım API'sini taklit eder: `mode` paylaşımın sonucunu belirler. */
async function stubShare(page: Page, mode: 'ok' | 'abort' | 'none'): Promise<void> {
  await page.addInitScript((m) => {
    const nav = navigator as Navigator & { canShare?: unknown; share?: unknown }
    if (m === 'none') {
      Object.defineProperty(nav, 'canShare', { value: undefined, configurable: true })
      return
    }
    Object.defineProperty(nav, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(nav, 'share', {
      value: () => (m === 'ok' ? Promise.resolve() : Promise.reject(new DOMException('iptal', 'AbortError'))),
      configurable: true,
    })
  }, mode)
}

test('yedek zamanı geldiyse özette paylaşımla yedeklenir ve işaretlenir', async ({ page }) => {
  await stubShare(page, 'ok')
  await seed(page, dueState())
  await finishWorkout(page)

  await page.getByRole('button', { name: 'Yedeği kaydet' }).click()
  await expect(page.getByText('✓ Yedek kaydedildi.')).toBeVisible()
  expect((await readState(page)).settings.lastBackupAt).toBeGreaterThan(Date.now() - 60_000)
})

test('paylaşım iptal edilirse yedek alınmış sayılmaz', async ({ page }) => {
  await stubShare(page, 'abort')
  await seed(page, dueState())
  await finishWorkout(page)

  await page.getByRole('button', { name: 'Yedeği kaydet' }).click()
  await expect(page.getByRole('button', { name: 'Yedeği kaydet' })).toBeVisible()
  expect((await readState(page)).settings.lastBackupAt).toBeUndefined()
})

test('paylaşım yoksa yedek dosyası indirilir', async ({ page }) => {
  await stubShare(page, 'none')
  await seed(page, dueState())
  await finishWorkout(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Yedeği kaydet' }).click()
  expect((await download).suggestedFilename()).toMatch(/^monk-mode-yedek-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText('✓ Yedek indirildi.')).toBeVisible()
})
