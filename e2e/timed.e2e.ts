import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { readState, seed } from './seed.ts'

const PLANK = 'Plank'

test('süreli set: rutinden gelir, süre yazılır, kronometre doldurur, hacim ve 1RM oluşmaz', async ({ page }) => {
  const s = defaultState()
  s.routines = [
    {
      id: 'r-core',
      name: 'E2E Core',
      ex: [{ exId: PLANK, sets: 2, reps: 30, repsMax: 30, weight: 0, prog: 'double', inc: 0, timed: true, bw: true }],
    },
  ]
  await seed(page, JSON.stringify(s))
  // "Tamamlanmayan set" onayı çıkmasın diye iki set de tamamlanır; yine de olası onayı kabul et.
  page.on('dialog', (d) => void d.accept())

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Core/ }).click()

  // Hedef süre alanda d:ss olarak görünür; sütun başlığı "Süre".
  const sec1 = page.getByRole('textbox', { name: 'Set 1 süre' })
  await expect(sec1).toHaveValue('0:30')
  await expect(page.getByText('Süre', { exact: true })).toBeVisible()

  // Elle: "1:30" yazılır ve set tamamlanır.
  await sec1.fill('1:30')
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()

  // Kronometre: başlat, kısa bekle, durdur; süre alana yazılır.
  await page.getByRole('button', { name: 'Set 2 süre başlat' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Set 2 süre durdur' }).click()
  await expect(page.getByRole('textbox', { name: 'Set 2 süre' })).toHaveValue(/^0:0[1-3]$/)
  await page.getByRole('button', { name: 'Seti tamamla' }).click()

  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  // Süreli antrenmanda hacim satırı yok; rekor (ilk tutuş) var.
  await expect(page.getByText('Toplam hacim')).toHaveCount(0)
  await expect(page.getByText('Yeni rekorlar')).toBeVisible()

  const state = await readState(page)
  const entry = state.workouts[0].entries[0]
  expect(entry.timed).toBe(true)
  expect(entry.sets[0]).toMatchObject({ w: 0, r: 90, done: true })
  expect(entry.sets[1].r).toBeGreaterThanOrEqual(1)
  expect(entry.sets[1].r).toBeLessThanOrEqual(3)
})

test('rutin düzenleyicide "Süreli" hedefi saniyeye çevirir ve kaydeder', async ({ page }) => {
  const s = defaultState()
  s.routines = [{ id: 'r1', name: 'E2E Core', ex: [{ exId: PLANK, sets: 3, reps: 8, repsMax: 12, weight: 0, prog: 'double', inc: 2.5 }] }]
  await seed(page, JSON.stringify(s))

  await page.goto('./#/plan/r/r1')
  await page.getByRole('checkbox', { name: /Süreli/ }).check()
  await expect(page.getByRole('textbox', { name: 'Süre (sn)', exact: true })).toHaveValue('30')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  const state = await readState(page)
  expect(state.routines[0].ex[0]).toMatchObject({ timed: true, reps: 30, repsMax: 30 })
})
