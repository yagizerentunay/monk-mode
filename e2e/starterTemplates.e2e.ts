import { expect, test, type Page } from '@playwright/test'
import { readState } from './seed.ts'

async function openTemplates(page: Page): Promise<void> {
  await page.goto('./#/plan')
  await page.getByRole('tab', { name: 'Rutinler' }).click()
  await page.getByRole('button', { name: 'Başlangıç şablonları' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('üç şablon listelenir: Full Body önerilen, PPL 6 gün önerilir notuyla', async ({ page }) => {
  await openTemplates(page)
  const sheet = page.getByRole('dialog')
  const fullBody = sheet.locator('[data-template="full-body"]')
  await expect(fullBody.getByText('Önerilen başlangıç')).toBeVisible()
  await expect(fullBody.getByRole('button', { name: '2 rutini ekle' })).toBeVisible()
  await expect(sheet.locator('[data-template="upper-lower"]').getByRole('button', { name: '4 rutini ekle' })).toBeVisible()
  const ppl = sheet.locator('[data-template="ppl"]')
  await expect(ppl.getByText(/^⚠ 6 gün önerilir/)).toBeVisible()
  await expect(ppl.getByRole('button', { name: '3 rutini ekle' })).toBeVisible()
  // Önerilen başlangıç listenin en üstünde.
  await expect(sheet.locator('[data-template]').first()).toHaveAttribute('data-template', 'full-body')
})

test('içerik eklemeden önce görülür; Atlas hareketleri doğrudan kullanılır', async ({ page }) => {
  await openTemplates(page)
  const fullBody = page.getByRole('dialog').locator('[data-template="full-body"]')
  await fullBody.getByText('İçeriği gör').click()
  await expect(fullBody.getByText('Barbell Back Squat · 3 × 6–10')).toBeVisible()
  await expect(fullBody.getByText('Forearm Plank · 3 × 20–60 sn').first()).toBeVisible()
  await expect(fullBody.getByText('Leg Press · 3 × 8–12')).toBeVisible()
  await expect(fullBody.getByText('Incline Dumbbell Press · 3 × 8–12')).toBeVisible()
})

test('Full Body eklenir: iki rutin, doğru ayarlar; geri al kaldırır; ikinci ekleme (2) adı alır', async ({ page }) => {
  await openTemplates(page)
  await page.getByRole('dialog').locator('[data-template="full-body"]').getByRole('button', { name: '2 rutini ekle' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Full Body eklendi: Full Body A, Full Body B')).toBeVisible()
  await expect(page.locator('.routinecard', { hasText: 'Full Body A' })).toContainText('6 egzersiz')
  await expect(page.locator('.routinecard', { hasText: 'Full Body B' })).toContainText('7 egzersiz')

  const state = await readState(page)
  expect(state.routines.map((r) => r.name)).toEqual(['Full Body A', 'Full Body B'])
  const squat = state.routines[0].ex[0]
  expect(squat).toMatchObject({ exId: 'Barbell_Squat', sets: 3, reps: 6, repsMax: 10, weight: 0, prog: 'double', restSec: 150 })
  const plank = state.routines[0].ex.at(-1)!
  expect(plank).toMatchObject({ exId: 'Plank', timed: true, reps: 20, repsMax: 60 })

  await page.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.locator('.routinecard')).toHaveCount(0)
  expect((await readState(page)).routines).toHaveLength(0)

  await page.getByRole('button', { name: 'Başlangıç şablonları' }).click()
  await page.getByRole('dialog').locator('[data-template="full-body"]').getByRole('button', { name: '2 rutini ekle' }).click()
  await page.getByRole('button', { name: 'Başlangıç şablonları' }).click()
  await page.getByRole('dialog').locator('[data-template="full-body"]').getByRole('button', { name: '2 rutini ekle' }).click()
  expect((await readState(page)).routines.map((r) => r.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body A (2)', 'Full Body B (2)'])
})

test('eklenen şablon rutini antrenmanda çalışır: ilk set tamamlanır, süreli plank gelir', async ({ page }) => {
  await openTemplates(page)
  await page.getByRole('dialog').locator('[data-template="full-body"]').getByRole('button', { name: '2 rutini ekle' }).click()
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /Full Body A/ }).click()
  await expect(page.getByText('Barbell Back Squat').first()).toBeVisible()
  await expect(page.getByText('Forearm Plank').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Seti tamamla' }).first()).toBeVisible()
})
