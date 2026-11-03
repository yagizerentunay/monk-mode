import { expect, test } from '@playwright/test'
import { exportBackup } from '../src/store/backup.ts'
import type { Workout } from '../src/store/schema.ts'
import { readState, seed, stateWithRoutine } from './seed.ts'

const wk = (id: string, d: string, start: number, w = 60): Workout => ({
  id,
  d,
  start,
  end: start + 3_600_000,
  name: 'E2E Push',
  entries: [{ exId: 'bench', sets: [{ w, r: 5, done: true }] }],
})

test('başka cihazın yedeği önizlenir, onayla birleştirilir: yeni gelir, çakışmada yerel kalır, ikinci kez değişmez', async ({ page }) => {
  const local = { ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000), wk('w2', '2026-03-03', 2000)] }
  const other = {
    ...stateWithRoutine(),
    workouts: [wk('w1', '2026-03-02', 1000), wk('w2', '2026-03-03', 2000, 99), wk('w3', '2026-03-01', 500)],
    bodyweight: [{ d: '2026-03-01', w: 80 }],
  }
  await seed(page, JSON.stringify(local))
  await page.goto('./#/settings')

  const file = { name: 'baska-cihaz.json', mimeType: 'application/json', buffer: Buffer.from(exportBackup(other)) }
  const input = page.locator('.mergecard input[type=file]')
  await page.getByRole('button', { name: 'Al', exact: true }).click()
  await input.setInputFiles(file)

  // Önizleme: birleşmeden önce ne olacağı gösterilir ve veri değişmez.
  await expect(page.getByText('baska-cihaz.json: 1 antrenman, 1 kilo kaydı eklendi; 2 kayıt zaten vardı; 1 kayıt farklı, yereldeki korundu.')).toBeVisible()
  expect((await readState(page)).workouts).toHaveLength(2)

  await page.getByRole('button', { name: 'Birleştir', exact: true }).click()
  await expect(page.getByText('Birleştirildi: 1 antrenman, 1 kilo kaydı eklendi; 2 kayıt zaten vardı; 1 kayıt farklı, yereldeki korundu.')).toBeVisible()
  const state = await readState(page)
  expect(state.workouts.map((w) => w.id)).toEqual(['w3', 'w1', 'w2'])
  expect(state.workouts[2].entries[0].sets[0].w).toBe(60)
  expect(state.bodyweight).toEqual([{ d: '2026-03-01', w: 80 }])

  // İkinci kez: yeni kayıt yok, Birleştir düğmesi çıkmaz.
  await input.setInputFiles(file)
  await expect(page.getByText('baska-cihaz.json: yeni kayıt yok; 4 kayıt zaten vardı; 1 kayıt farklı, yereldeki korundu.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Birleştir', exact: true })).toHaveCount(0)
  expect((await readState(page)).workouts).toHaveLength(3)
})

test('önizlemede vazgeçilirse hiçbir şey birleşmez', async ({ page }) => {
  await seed(page, JSON.stringify({ ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000)] }))
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Al', exact: true }).click()
  const other = { ...stateWithRoutine(), workouts: [wk('w1', '2026-03-02', 1000), wk('w9', '2026-03-05', 5000)] }
  await page.locator('.mergecard input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(exportBackup(other)) })
  await expect(page.getByText('x.json: 1 antrenman eklendi; 2 kayıt zaten vardı.')).toBeVisible()
  await page.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(page.getByText('x.json:')).toHaveCount(0)
  expect((await readState(page)).workouts.map((w) => w.id)).toEqual(['w1'])
})

test('geçersiz dosya anlaşılır hata verir ve veriyi değiştirmez', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Al', exact: true }).click()
  await page.locator('.mergecard input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') })
  await expect(page.getByText('Bu dosya bir monk-mode yedeği değil.')).toBeVisible()
})
