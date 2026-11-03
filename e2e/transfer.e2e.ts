import { expect, test, type Page } from '@playwright/test'
import { exportBackup, importBackup } from '../src/store/backup.ts'
import type { Workout } from '../src/store/schema.ts'
import { readState, seed, stateWithRoutine } from './seed.ts'

const wk = (id: string, d: string, start: number): Workout => ({
  id,
  d,
  start,
  end: start + 3_600_000,
  name: 'E2E Push',
  entries: [{ exId: 'bench', sets: [{ w: 60, r: 5, done: true }] }],
})

/** Paylaşım menüsünü taklit eder; paylaşılan dosyanın adı ve metni `window.__shared`'e yazılır. */
async function stubShare(page: Page, mode: 'ok' | 'none'): Promise<void> {
  await page.addInitScript((m) => {
    const nav = navigator as Navigator & { canShare?: unknown; share?: unknown }
    if (m === 'none') {
      Object.defineProperty(nav, 'canShare', { value: undefined, configurable: true })
      return
    }
    Object.defineProperty(nav, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(nav, 'share', {
      value: async (data: { files: File[] }) => {
        const f = data.files[0]
        ;(window as unknown as { __shared: unknown }).__shared = { name: f.name, text: await f.text() }
      },
      configurable: true,
    })
  }, mode)
}

test('Gönder: yedek girintisiz dosya olarak paylaşılır ve geri okunabilir', async ({ page }) => {
  await stubShare(page, 'ok')
  const local = { ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000)] }
  await seed(page, JSON.stringify(local))
  await page.goto('./#/settings')

  await page.getByRole('button', { name: 'Dosyayı gönder' }).click()
  await expect(page.getByText('Dosya paylaşıldı. Diğer cihazda Al sekmesinden seç.')).toBeVisible()
  const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; text: string } }).__shared)
  expect(shared.name).toMatch(/^monk-mode-yedek-\d{4}-\d{2}-\d{2}\.json$/)
  expect(shared.text).not.toContain('\n')
  expect(importBackup(shared.text).workouts.map((w) => w.id)).toEqual(['w1'])
})

test('Gönder: paylaşım yoksa dosya indirilir', async ({ page }) => {
  await stubShare(page, 'none')
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/settings')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dosyayı gönder' }).click()
  expect((await download).suggestedFilename()).toMatch(/^monk-mode-yedek-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText('Dosya indirildi. Diğer cihaza ilet, orada Al sekmesinden seç.')).toBeVisible()
})

test('Android paylaşım menüsünden gelen yedek Al sekmesinde önizlenir, onayla birleşir', async ({ page, context }) => {
  await seed(page, JSON.stringify({ ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000)] }))
  // Service worker paylaşım isteğini yakalayabilmek için sayfayı kontrol ediyor olmalı.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const other = { ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000), wk('w2', '2026-03-09', 9000)] }
  // Gerçek paylaşım menüsü uygulamanın dışından gelir; uygulamanın CSP'si (form-action 'none') bu isteği
  // kapsamaz. Aynı etkiyi başka bir kökenden yapılan multipart POST ile veririz; service worker ikisini de görür.
  const shared = await context.newPage()
  await shared.route('http://paylasim.test/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>x</title>' }))
  await shared.goto('http://paylasim.test/')
  await shared.evaluate(
    ([text, action]) => {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = action
      form.enctype = 'multipart/form-data'
      const input = document.createElement('input')
      input.type = 'file'
      input.name = 'backup'
      const dt = new DataTransfer()
      dt.items.add(new File([text], 'baska-cihaz.json', { type: 'application/json' }))
      input.files = dt.files
      form.append(input)
      document.body.append(form)
      form.submit()
    },
    [exportBackup(other, new Date(), { compact: true }), new URL('./?share-target', page.url()).href] as const,
  )

  await expect(shared.getByText('baska-cihaz.json: 1 antrenman eklendi; 2 kayıt zaten vardı.')).toBeVisible()
  await expect(shared.getByRole('button', { name: 'Al', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // Adres temizlendi; sayfa yenilenince eski paylaşım tekrar önizlenmez.
  await expect.poll(() => shared.url()).not.toContain('aktarim')
  expect((await readState(shared)).workouts.map((w) => w.id)).toEqual(['w1'])

  await shared.getByRole('button', { name: 'Birleştir', exact: true }).click()
  await expect(shared.getByText('Birleştirildi: 1 antrenman eklendi; 2 kayıt zaten vardı.')).toBeVisible()
  expect((await readState(shared)).workouts.map((w) => w.id)).toEqual(['w1', 'w2'])

  await shared.reload()
  await expect(shared.getByText('baska-cihaz.json:')).toHaveCount(0)
})

test('manifest paylaşım hedefini yalnız yedek dosyası için tanımlar', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json()
  expect(manifest.share_target).toMatchObject({ method: 'POST', enctype: 'multipart/form-data' })
  expect(manifest.share_target.params.files).toEqual([{ name: 'backup', accept: ['application/json', '.json'] }])
})
