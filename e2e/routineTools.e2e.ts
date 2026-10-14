import { expect, test } from '@playwright/test'
import { defaultState, type ExCfg, type State } from '../src/store/schema.ts'
import { BENCH, readState, seed } from './seed.ts'

const CURL = 'Dumbbell_Bicep_Curl'
const DB_PRESS = 'Dumbbell_Bench_Press'

const cfg = (exId: string, patch: Partial<ExCfg> = {}): ExCfg => ({
  exId,
  sets: 2,
  reps: 8,
  weight: 40,
  prog: 'off',
  inc: 2.5,
  repsMax: 12,
  ...patch,
})

const ROUTINE_EX = [cfg(BENCH, { warmups: 1, restSec: 120 }), cfg(CURL, { superset: true, drops: 1 })]

test('rutini kopyalar: yeni kimlik ve ad, hafta gününe atanmaz, düzenleyici kopyayı açar', async ({ page }) => {
  const state: State = {
    ...defaultState(),
    routines: [{ id: 'r1', name: 'E2E Akış', ex: ROUTINE_EX }],
    week: { 1: 'r1' },
  }
  await seed(page, JSON.stringify(state))
  await page.goto('./#/plan/r/r1')
  await page.getByRole('button', { name: 'Rutini kopyala' }).click()

  await expect(page.getByRole('textbox', { name: 'Rutin adı' })).toHaveValue('E2E Akış (kopya)')
  await expect(page).not.toHaveURL(/\/plan\/r\/r1$/)

  const saved = await readState(page)
  expect(saved.routines).toHaveLength(2)
  const [orig, copy] = saved.routines
  expect(copy.id).not.toBe(orig.id)
  expect(copy.ex).toEqual(orig.ex)
  expect(saved.week).toEqual({ 1: 'r1' })

  // İkinci kopya sayaç alır.
  await page.getByRole('button', { name: 'Rutini kopyala' }).click()
  await expect(page.getByRole('textbox', { name: 'Rutin adı' })).toHaveValue('E2E Akış (kopya 2)')
})

test('seansta egzersiz sırası değişir: tamamlanan set ve dinlenme sayacı korunur, rutin değişmez', async ({ page }) => {
  const state: State = {
    ...defaultState(),
    routines: [{ id: 'r1', name: 'E2E Akış', ex: [cfg(BENCH), cfg(CURL), cfg(DB_PRESS)] }],
  }
  await seed(page, JSON.stringify(state))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Akış/ }).click()

  const cards = page.locator('.excard')
  await expect(cards).toHaveCount(3)
  await cards.nth(0).getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(page.getByRole('timer')).toBeVisible()

  await expect(cards.nth(0).getByRole('button', { name: /yukarı taşı$/ })).toBeDisabled()
  await expect(cards.nth(2).getByRole('button', { name: /aşağı taşı$/ })).toBeDisabled()

  const firstName = (await cards.nth(0).locator('.exhead').textContent()) ?? ''
  await cards.nth(0).getByRole('button', { name: /aşağı taşı$/ }).click()
  await expect(cards.nth(1).locator('.exhead')).toHaveText(firstName)
  await expect(cards.nth(1).locator('.eyebrow')).toContainText('Egzersiz 02')
  await expect(page.getByRole('timer')).toBeVisible()

  const saved = await readState(page)
  expect(saved.active?.entries.map((e) => e.exId)).toEqual([CURL, BENCH, DB_PRESS])
  expect(saved.active?.entries[1].sets[0].done).toBe(true)
  expect(saved.routines[0].ex.map((e) => e.exId)).toEqual([BENCH, CURL, DB_PRESS])
})
