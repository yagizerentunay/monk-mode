import { expect, test } from '@playwright/test'

test('çekmece odağı içeride tutar, kapanınca açan düğmeye döner, arka planı kilitler', async ({ page }) => {
  await page.goto('./')
  const opener = page.getByRole('button', { name: 'Takvim' })
  await opener.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog).toHaveAccessibleName(/.+/)
  expect(await page.evaluate(() => document.querySelector('.sheet')!.contains(document.activeElement))).toBe(true)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  // İleri ve geri Tab'larla odak hiç dışarı çıkmamalı.
  for (const key of [...Array(25).fill('Tab'), ...Array(25).fill('Shift+Tab')]) {
    await page.keyboard.press(key)
    expect(await page.evaluate(() => document.querySelector('.sheet')!.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})
