import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { exportBackup } from '../src/store/backup.ts'
import { defaultState, type State } from '../src/store/schema.ts'
import { readState, seed } from './seed.ts'

/** Yerel gün, YYYY-MM-DD (uygulamanın dayString'i ile aynı). */
const today = (): string => new Date().toLocaleDateString('sv-SE')

const withMeasurement = (): State => ({ ...defaultState(), measurements: [{ d: '2020-01-05', waist: 85, fat: 18 }] })

const card = (page: Page) => page.locator('.card', { has: page.getByRole('heading', { name: 'Ölçüler' }) })

test('ölçü girilir, seçilen ölçünün son değişimi gösterilir, aynı gün ikinci giriş üzerine yazar', async ({ page }) => {
  await seed(page, JSON.stringify(withMeasurement()))
  await page.goto('./#/stats')
  const c = card(page)
  await expect(c.locator('.bignum')).toHaveText('85')
  await expect(c).toContainText('Karşılaştırma için bir ölçüm daha gerekli.')

  await c.getByRole('button', { name: 'Ölçü ekle' }).click()
  const sheet = page.getByRole('dialog', { name: 'Bugünkü ölçüler' })
  const save = sheet.getByRole('button', { name: 'Ölçüleri kaydet' })
  await expect(save).toBeDisabled()
  await sheet.getByLabel('Kol (cm)').fill('abc')
  await expect(sheet.getByRole('alert')).toBeVisible()
  await expect(save).toBeDisabled()
  await sheet.getByLabel('Kol (cm)').fill('')
  await sheet.getByLabel('Bel (cm)').fill('83,5')
  await sheet.getByLabel('Yağ (%)').fill('17.5')
  await save.click()
  await expect(sheet).toBeHidden()

  await expect(c.locator('.bignum')).toHaveText('83,5')
  await expect(c.locator('.statdelta')).toHaveText('↘ -1,5 cm · önceki ölçüme göre')
  await c.getByRole('button', { name: 'Yağ' }).click()
  await expect(c.locator('.bignum')).toHaveText('17,5')
  await expect(c.locator('.statdelta')).toHaveText('↘ -0,5 % · önceki ölçüme göre')

  expect((await readState(page)).measurements).toEqual([
    { d: '2020-01-05', waist: 85, fat: 18 },
    { d: today(), waist: 83.5, fat: 17.5 },
  ])

  // İkinci giriş: form bugünkü kayıtla açılır; kaydetmek o günün kaydının yerine geçer.
  await c.getByRole('button', { name: 'Ölçü ekle' }).click()
  await expect(sheet.getByLabel('Bel (cm)')).toHaveValue('83,5')
  await sheet.getByLabel('Bel (cm)').fill('83')
  await sheet.getByLabel('Yağ (%)').fill('')
  await sheet.getByLabel('Göğüs (cm)').fill('101')
  await save.click()

  expect((await readState(page)).measurements).toEqual([
    { d: '2020-01-05', waist: 85, fat: 18 },
    { d: today(), waist: 83, chest: 101 },
  ])
  // Bugün yağ ölçülmedi: yağ seyri yine tek eski ölçüme döner.
  await expect(c.locator('.bignum')).toHaveText('18')
  await c.getByRole('button', { name: 'Bel' }).click()
  await expect(c.locator('.statdelta')).toHaveText('↘ -2 cm · önceki ölçüme göre')
})

test('ölçüler yedekle birleştirilir ve ayrı CSV olarak dışa aktarılır', async ({ page }) => {
  await seed(page, JSON.stringify(withMeasurement()))
  await page.goto('./#/settings')

  const other = { ...defaultState(), measurements: [{ d: '2020-01-05', waist: 90 }, { d: '2020-01-12', waist: 84.5, arm: 36 }] }
  const file = { name: 'baska-cihaz.json', mimeType: 'application/json', buffer: Buffer.from(exportBackup(other)) }
  await page.locator('.mergecard input[type=file]').setInputFiles(file)
  await expect(page.getByText('Birleştirildi: 1 ölçü kaydı eklendi; 1 kayıt farklı, yereldeki korundu.')).toBeVisible()
  expect((await readState(page)).measurements).toEqual([
    { d: '2020-01-05', waist: 85, fat: 18 },
    { d: '2020-01-12', waist: 84.5, arm: 36 },
  ])

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Ölçüleri CSV olarak kaydet' }).click()
  const csv = await download
  expect(csv.suggestedFilename()).toMatch(/^monk-mode-olculer-\d{4}-\d{2}-\d{2}\.csv$/)
  await expect(page.getByText('CSV indirildi: 2 ölçü kaydı.')).toBeVisible()

  const bytes = await readFile((await csv.path()) as string)
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(bytes.toString('utf8').replace(/^﻿/, '').split('\r\n')).toEqual([
    'Tarih;Bel (cm);Göğüs (cm);Kol (cm);Kalça (cm);Yağ (%)',
    '2020-01-05;85;;;;18',
    '2020-01-12;84,5;;36;;',
    '',
  ])
})
