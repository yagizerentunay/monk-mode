import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { readState, STORAGE_KEY, seed } from './seed.ts'

const CORRUPT = '{"broken'

test('okunamayan veri karantinaya alınır, üstüne yazılmaz ve uyarı gösterilir', async ({ page }) => {
  await seed(page, CORRUPT)

  await expect(page.getByText('Kayıtlı verin okunamadı')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ham veriyi indir' })).toBeVisible()

  const copies = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith('monk_state_corrupt_'))
        .map((k) => localStorage.getItem(k)),
    )
  expect(await copies()).toEqual([CORRUPT])

  // Uyarıyı kapatıp bir değişiklik yapınca ana anahtar yazılır; yan kopya kalır.
  await page.getByRole('button', { name: 'Kapat' }).click()
  await expect(page.getByText('Kayıtlı verin okunamadı')).toBeHidden()
  await page.goto('./#/settings')
  await page.locator('select').first().selectOption({ index: 1 })

  const main = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  expect(() => JSON.parse(main ?? '')).not.toThrow()
  expect(await copies()).toEqual([CORRUPT])
})

test('kayıt başarısız olunca uyarı çıkar, sonraki başarılı kayıtta kaybolur', async ({ page }) => {
  await page.goto('./#/settings')
  const select = page.locator('select').first()

  await page.evaluate(() => {
    const w = window as typeof window & { __setItem?: Storage['setItem'] }
    w.__setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
  })
  await select.selectOption({ index: 1 })
  await expect(page.getByText('Veriler kaydedilemiyor')).toBeVisible()

  await page.evaluate(() => {
    const w = window as typeof window & { __setItem?: Storage['setItem'] }
    Storage.prototype.setItem = w.__setItem!
  })
  await select.selectOption({ index: 2 })
  await expect(page.getByText('Veriler kaydedilemiyor')).toBeHidden()
})

test('bozuk kayıt atlanır: uygulama açılır, sağlam antrenman kalır, uyarı çıkar ve ham veri saklanır', async ({ page }) => {
  const good = {
    id: 'ok',
    d: '2026-10-02',
    start: 2,
    end: 3,
    name: 'Sağlam',
    entries: [{ exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: [{ w: 50, r: 5, done: true }] }],
  }
  // `entries` yok: eskiden her açılışta "t.entries is not iterable" ile boş ekran veriyordu.
  const broken = { id: 'x', d: '2026-10-01', start: 1, name: 'Bozuk' }
  const raw = JSON.stringify({ ...defaultState(), workouts: [broken, good] })
  await seed(page, raw)

  // Ana sayfa açıldı ve yedek kartı yalnız sağlam antrenmanı sayıyor.
  await expect(page.getByText('Rutin oluştur')).toBeVisible()
  await expect(page.getByText(/1 antrenman yalnızca bu tarayıcıda/)).toBeVisible()
  await expect(page.getByText('Bozuk kayıtlar atlandı')).toBeVisible()
  await expect(page.getByText('1 bozuk kayıt vardı; atlandı. Ham veri ayrı saklandı.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ham veriyi indir' })).toBeVisible()

  const copies = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('monk_state_corrupt_'))
      .map((k) => localStorage.getItem(k)),
  )
  expect(copies).toEqual([raw])

  // Sağlam antrenman geçmişte durur; temizlenmiş veri diske yazılınca bozuk kayıt yoktur.
  await page.goto('./#/settings')
  await page.locator('select').first().selectOption({ index: 1 })
  const saved = await readState(page)
  expect(saved.workouts.map((w) => w.id)).toEqual(['ok'])

  // Uyarı kalıcıdır (sayfa geçişlerinde durur), "Kapat" ile kapanır; yan kopya kalır.
  await expect(page.getByText('Bozuk kayıtlar atlandı')).toBeVisible()
  await page.getByRole('button', { name: 'Kapat' }).click()
  await expect(page.getByText('Bozuk kayıtlar atlandı')).toBeHidden()
  await page.reload()
  await expect(page.getByText('Bozuk kayıtlar atlandı')).toBeHidden()
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('monk_state_corrupt_')).length),
  ).toBe(1)
})
