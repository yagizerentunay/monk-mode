import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { seed, stateWithRoutine } from './seed.ts'

test('CSV dışa aktarma: dosya adı, BOM + başlık ve Türkçe Excel biçimi', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/settings')
  // Antrenman yokken buton kapalı.
  await expect(page.getByRole('button', { name: 'Antrenmanları CSV olarak kaydet' })).toBeDisabled()

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await complete.first().click()
  await complete.first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()

  await page.goto('./#/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Antrenmanları CSV olarak kaydet' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^monk-mode-antrenmanlar-\d{4}-\d{2}-\d{2}\.csv$/)
  await expect(page.getByText('CSV indirildi: 1 antrenman.')).toBeVisible()

  const bytes = await readFile((await file.path()) as string)
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = bytes.toString('utf8').replace(/^﻿/, '').split('\r\n')
  expect(lines[0]).toBe(
    'Tarih;Antrenman;Egzersiz;Set türü;Set no;Taraf;Ağırlık;Vücut ağırlığı;Toplam yük;Tekrar;RIR;Egzersiz notu;Antrenman notu;Süre (sn);Mesafe (m)',
  )
  // 2 tamamlanmış set + sondaki boş satır; egzersiz adı kütüphaneden gelir.
  expect(lines).toHaveLength(4)
  expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2};E2E Push;Barbell Bench Press;Çalışma;1;;60;;60;5;/)
})
