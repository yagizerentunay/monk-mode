import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { readState, seed } from './seed.ts'

const RUN = 'Running_Treadmill'

test('mesafe seti: rutinden gelir, km ve süre yazılır, tempo görünür, hacim yok, geçmişte görünür', async ({ page }) => {
  const s = defaultState()
  s.routines = [
    {
      id: 'r-run',
      name: 'E2E Koşu',
      ex: [{ exId: RUN, sets: 1, reps: 1800, repsMax: 1800, weight: 0, prog: 'off', inc: 0, distance: true, meters: 5000 }],
    },
  ]
  await seed(page, JSON.stringify(s))
  page.on('dialog', (d) => void d.accept())

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Koşu/ }).click()

  // Hedef rutinden: 5 km, 30:00; sütun başlıkları mesafe ve süre.
  const km = page.getByRole('textbox', { name: 'Set 1 mesafe' })
  const time = page.getByRole('textbox', { name: 'Set 1 süre' })
  await expect(km).toHaveValue('5')
  await expect(time).toHaveValue('30:00')
  await expect(page.locator('.setcols')).toContainText('Mesafe (km)')
  await expect(page.getByRole('button', { name: 'Mesafe (km)' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '+ Isınma' })).toBeDisabled()

  await km.fill('5,2')
  await time.fill('27:18')
  await expect(page.getByText('Tempo 5:15 /km')).toBeVisible()
  await page.getByRole('button', { name: 'Seti tamamla' }).click()
  // RIR mesafe setinde sorulmaz.
  await expect(page.getByRole('button', { name: /Set 1 RIR/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  await expect(page.getByText('Toplam hacim')).toHaveCount(0)
  await expect(page.getByText('Yeni rekorlar')).toBeVisible()

  const state = await readState(page)
  const entry = state.workouts[0].entries[0]
  expect(entry.distance).toBe(true)
  expect(entry.sets).toEqual([{ w: 0, r: 1638, m: 5200, done: true }])

  // Geçmiş: istatistikte toplam mesafe ve tempo, son antrenman detayında set özeti.
  await page.goto('./#/stats')
  await expect(page.getByText('km · toplam mesafe')).toBeVisible()
  await expect(page.getByText('Son seans en iyi tempo: 5:15 /km')).toBeVisible()
  await page.getByRole('button', { name: /E2E Koşu/ }).first().click()
  await expect(page.getByText('5,2 km · 27:18 · 5:15 /km').first()).toBeVisible()
})

test('rutin düzenleyicide "Mesafe" hedefi mesafe + süreye çevirir ve kaydeder', async ({ page }) => {
  const s = defaultState()
  s.routines = [{ id: 'r1', name: 'E2E Kardiyo', ex: [{ exId: RUN, sets: 3, reps: 8, repsMax: 12, weight: 0, prog: 'double', inc: 2.5 }] }]
  await seed(page, JSON.stringify(s))

  await page.goto('./#/plan/r/r1')
  await page.getByRole('checkbox', { name: /Mesafe/ }).check()
  await expect(page.getByRole('textbox', { name: 'Mesafe (km)', exact: true })).toHaveValue('5')
  await expect(page.getByRole('textbox', { name: 'Süre (dk)', exact: true })).toHaveValue('30:00')
  await page.getByRole('textbox', { name: 'Mesafe (km)', exact: true }).fill('10')
  await page.getByRole('textbox', { name: 'Süre (dk)', exact: true }).fill('55')
  // Ağırlık ve süreli seçenekleri mesafe egzersizinde gizli.
  await expect(page.getByRole('checkbox', { name: /Süreli/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Kaydet' }).click()

  const state = await readState(page)
  expect(state.routines[0].ex[0]).toMatchObject({ distance: true, meters: 10000, reps: 3300, sets: 1, prog: 'off', weight: 0 })
})
