import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { readState, seed } from './seed.ts'

test('kaydedilmiş antrenmanda vücut ağırlığı düzenlenir ve hacim yeniden hesaplanır', async ({ page }) => {
  const s = defaultState()
  s.workouts = [
    {
      id: 'w1',
      d: '2026-10-01',
      start: Date.UTC(2026, 9, 1, 10),
      end: Date.UTC(2026, 9, 1, 11),
      name: 'E2E Pull',
      entries: [{ exId: 'Pullups', bw: true, bwKg: 70, sets: [{ w: 0, r: 10, done: true }] }],
    },
  ]
  await seed(page, JSON.stringify(s))

  await page.goto('./#/stats')
  const row = page.locator('.exrow', { hasText: 'E2E Pull' })
  await expect(row).toContainText('700 kg')
  await row.click()
  await page.getByRole('button', { name: 'Düzenle' }).click()

  const field = page.getByLabel(/vücut ağırlığı$/)
  await field.fill('80')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  expect((await readState(page)).workouts[0].entries[0].bwKg).toBe(80)
  await page.keyboard.press('Escape')
  await expect(page.locator('.exrow', { hasText: 'E2E Pull' })).toContainText('800 kg')
})
