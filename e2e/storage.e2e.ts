import { expect, test } from '@playwright/test'
import { STORAGE_KEY, seed } from './seed.ts'

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
