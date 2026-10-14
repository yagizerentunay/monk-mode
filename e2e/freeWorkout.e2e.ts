import { expect, test } from '@playwright/test'
import { defaultState } from '../src/store/schema.ts'
import { BENCH, readState, seed, stateWithRoutine } from './seed.ts'

test('serbest antrenman: egzersiz son seansın değerleriyle eklenir ve rutinsiz kaydedilir', async ({ page }) => {
  const s = defaultState()
  s.workouts = [
    {
      id: 'w-old',
      d: '2026-10-01',
      start: Date.UTC(2026, 9, 1, 10),
      end: Date.UTC(2026, 9, 1, 11),
      name: 'Eski',
      entries: [{ exId: BENCH, sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }] }],
    },
  ]
  await seed(page, JSON.stringify(s))
  // "1 set tamamlanmadı, yine de bitirilsin mi?" onayı.
  page.on('dialog', (d) => void d.accept())

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /Serbest antrenman/ }).click()
  await expect(page.locator('.wk-title')).toHaveText('Serbest antrenman')
  await expect(page.getByText('Henüz egzersiz yok')).toBeVisible()

  await page.getByRole('button', { name: '+ Egzersiz ekle' }).click()
  await page.getByPlaceholder('Egzersiz ara…').fill('bench press')
  await page.locator('.exrow', { has: page.locator('.exname', { hasText: /^Barbell Bench Press$/ }) }).click()

  // Son seans: 2 set, 60 kg, en düşük tekrar 7.
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await expect(complete).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: /Set 1 ağırlık/ })).toHaveValue('60')

  await complete.first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()

  const state = await readState(page)
  expect(state.active).toBeNull()
  expect(state.workouts).toHaveLength(2)
  const free = state.workouts[1]
  expect(free.name).toBe('Serbest antrenman')
  expect(free.routineId).toBeUndefined()
  expect(free.entries[0].sets.filter((x) => x.done)).toHaveLength(1)
  expect(free.entries[0].sets[0]).toMatchObject({ w: 60, r: 7 })
})

test('egzersize özel dinlenme: rutinde ayarlanır ve sayaç o süreyle başlar', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))

  await page.goto('./#/plan/r/r-push')
  // Özelleştirilmiş egzersizde bölüm zaten açık gelir; kapalıysa aç.
  const adv = page.locator('details.adv').first()
  if (!(await adv.evaluate((el: HTMLDetailsElement) => el.open))) await adv.locator('summary').click()
  await page.getByLabel('Dinlenme (sn)').fill('150')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  const state = await readState(page)
  expect(state.routines[0].ex[0].restSec).toBe(150)

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  // Genel ayar 90 sn (1:30); egzersizin kendi süresi 150 sn (2:30).
  await expect(page.getByRole('timer')).toContainText(/2:(29|30)/)
})

test('rutin düzenleyici set sayısını yükleyicinin kabul ettiği sınırla (20) kısıtlar', async ({ page }) => {
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/plan/r/r-push')
  const sets = page.getByRole('textbox', { name: 'Set', exact: true })
  await sets.fill('300')
  await sets.blur()
  await expect(sets).toHaveValue('20')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await page.reload()
  const state = await readState(page)
  expect(state.routines[0].ex[0].sets).toBe(20)
})
