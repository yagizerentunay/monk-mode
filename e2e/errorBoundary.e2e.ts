import { expect, test } from '@playwright/test'
import { exportBackup } from '../src/store/backup.ts'
import { defaultState } from '../src/store/schema.ts'
import { readState, seed, STORAGE_KEY, stateWithRoutine } from './seed.ts'

// Service worker kapalı: parça isteklerini page.route yakalasın, önbellekten gelmesin.
test.use({ serviceWorkers: 'block' })

test('ekran parçası yüklenemezse sekme çubuğu ayakta kalır, kurtarma ekranı çıkar ve Ana sayfa çalışır', async ({ page }) => {
  await page.route(/\/assets\/Stats-[^/]*\.js(\?.*)?$/, (route) => route.fulfill({ status: 500, body: 'boom' }))
  await page.goto('./')
  await expect(page.getByRole('link', { name: 'Ana', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Analiz' }).click()

  const alert = page.getByRole('alert').filter({ hasText: 'Sayfa yüklenemedi' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('bağlantını kontrol edip yenile')
  await expect(alert.getByRole('button', { name: 'Yenile' })).toBeVisible()
  // Sekme çubuğu hâlâ kullanılabilir.
  await expect(page.getByRole('link', { name: 'Ana', exact: true })).toBeVisible()

  await alert.getByRole('button', { name: 'Ana sayfa' }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(alert).toBeHidden()

  // Bozuk ekrandan sekmeyle de çıkılır; rota değişince sınır sıfırlanır.
  await page.getByRole('link', { name: 'Analiz' }).click()
  await expect(alert).toBeVisible()
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await expect(alert).toBeHidden()
  await expect(page.locator('main.app').filter({ hasText: 'Haftalık program' })).toBeVisible()
})

test('Yenile düğmesi sayfayı yeniden yükler', async ({ page }) => {
  let broken = true
  await page.route(/\/assets\/Stats-[^/]*\.js(\?.*)?$/, (route) =>
    broken ? route.fulfill({ status: 500, body: 'boom' }) : route.continue(),
  )
  await page.goto('./#/stats')
  const alert = page.getByRole('alert').filter({ hasText: 'Sayfa yüklenemedi' })
  await expect(alert).toBeVisible()

  broken = false
  await alert.getByRole('button', { name: 'Yenile' }).click()
  await expect(page.locator('main.app').filter({ hasText: 'Performans analizi' })).toBeVisible()
})

test('render hatası beyaz ekran bırakmaz: ya veri onarılır ya kurtarma ekranı açılır', async ({ page }) => {
  // Antrenmanda `entries` yok: şu an görünümler bunu render edemez. Veri doğrulaması eklenince migrate
  // kaydı atabilir; bu yüzden iki sonuç da kabul edilir, ama sayfa asla boş kalmamalı.
  const bad = { ...defaultState(), workouts: [{ id: 'w1', date: '2026-01-01', name: 'Bozuk' }] }
  const raw = JSON.stringify(bad)
  await seed(page, raw)

  await expect(page.getByRole('link', { name: 'Ana', exact: true })).toBeVisible()
  const alert = page.getByRole('alert').filter({ hasText: 'Bir şeyler ters gitti' })
  if (await alert.isVisible()) {
    await expect(alert.getByRole('button', { name: 'Yeniden dene' })).toBeVisible()
    await expect(alert.getByText('Teknik ayrıntı')).toBeVisible()

    // Ham veri, saklanan metnin kendisidir.
    const download = page.waitForEvent('download')
    await alert.getByRole('button', { name: 'Ham veriyi indir' }).click()
    const file = await download.then((d) => d.createReadStream())
    const chunks: Buffer[] = []
    for await (const c of file) chunks.push(c as Buffer)
    expect(Buffer.concat(chunks).toString('utf8')).toBe(raw)

    // Otomatik kopya yokken geri yükleme seçeneği gizli; kopya varsa tarihiyle görünür ve işe yarar.
    await expect(alert.getByRole('button', { name: 'Son otomatik kopyayı geri yükle' })).toBeHidden()
    const good = stateWithRoutine()
    const at = Date.now()
    await page.evaluate(
      ([text, when]) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('monk-mode', 1)
          req.onupgradeneeded = () => req.result.createObjectStore('snapshots', { keyPath: 'at' })
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const tx = req.result.transaction('snapshots', 'readwrite')
            tx.objectStore('snapshots').put({ at: when, reason: 'E2E', workouts: 0, hash: 'e2e', text })
            tx.oncomplete = () => resolve()
          }
        }),
      [exportBackup(good), at] as const,
    )
    await page.reload()
    await expect(alert).toBeVisible()
    await expect(alert.getByText('Son kopya:')).toBeVisible()
    page.once('dialog', (d) => void d.accept())
    await alert.getByRole('button', { name: 'Son otomatik kopyayı geri yükle' }).click()
    await expect(alert).toBeHidden()
    expect((await readState(page)).routines.map((r) => r.name)).toEqual(['E2E Push'])

    // Ayarlar yedek indirme/yükleme için hâlâ erişilebilir olmalı (bozuk ekran değil).
    await page.goto('./#/settings')
    await expect(page.locator('main.app').filter({ hasText: 'monk-mode v' })).toBeVisible()
  } else {
    await expect(page.locator('main.app')).not.toBeEmpty()
  }
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).not.toBeNull()
})
