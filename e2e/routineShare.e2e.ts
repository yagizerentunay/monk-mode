import { expect, test } from '@playwright/test'
import { defaultState, type ExCfg, type State } from '../src/store/schema.ts'
import { BENCH, readState, seed } from './seed.ts'

const cfg = (exId: string, patch: Partial<ExCfg> = {}): ExCfg => ({
  exId,
  sets: 3,
  reps: 6,
  weight: 60,
  prog: 'double',
  inc: 2.5,
  repsMax: 10,
  ...patch,
})

const SENDER: State = {
  ...defaultState(),
  routines: [
    {
      id: 'r-share',
      name: 'Paylaşılan Push',
      ex: [
        cfg(BENCH, { warmups: 2, restSec: 150 }),
        cfg('c-landmine', { superset: true }),
        cfg('Gone_From_Library', { sets: 2 }),
      ],
    },
  ],
  customEx: [{ id: 'c-landmine', name: 'Landmine press', primaryMuscles: ['shoulders'], equipment: 'barbell' }],
}

test('paylaşım linki ve QR üretilir; link açılınca önizlenir ve rutin eklenir', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & { __csp?: string[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => w.__csp!.push(`${e.violatedDirective} ${e.blockedURI}`))
  })

  // Paylaşan: rutin düzenleyicisinden link ve QR.
  await seed(page, JSON.stringify(SENDER))
  await page.goto('./#/plan/r/r-share')
  await page.getByRole('button', { name: 'Rutini paylaş' }).click()
  await expect(page.getByRole('img', { name: /Paylaşılan Push rutininin paylaşım QR kodu/ })).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Paylaşım linki' }).inputValue()
  expect(link).toMatch(/#\/share\/[A-Za-z0-9_-]+$/)

  // Alan: boş olmayan başka bir cihaz (aynı adlı rutini zaten var).
  await seed(page, JSON.stringify({ ...defaultState(), routines: [{ id: 'mine', name: 'Paylaşılan Push', ex: [cfg(BENCH)] }] }))
  await page.goto(link)
  await expect(page.getByRole('heading', { name: 'Paylaşılan Push' })).toBeVisible()
  await expect(page.getByText('Landmine press')).toBeVisible()
  await expect(page.getByText('özel egzersiz olarak eklenecek')).toBeVisible()
  await expect(page.getByText('1 hareket kütüphanende olmadığı için atlanacak')).toBeVisible()
  await page.getByRole('button', { name: 'Rutinlerime ekle' }).click()

  await expect(page).toHaveURL(/#\/plan\/r\//)
  await expect(page.getByRole('textbox', { name: 'Rutin adı' })).toHaveValue('Paylaşılan Push (2)')
  const saved = await readState(page)
  expect(saved.routines).toHaveLength(2)
  const added = saved.routines[1]
  expect(added.id).not.toBe('r-share')
  expect(added.ex).toEqual(SENDER.routines[0].ex.slice(0, 2))
  expect(saved.customEx).toEqual(SENDER.customEx)

  const violations = await page.evaluate(() => (window as typeof window & { __csp?: string[] }).__csp)
  expect(violations).toEqual([])
})

test('bozuk paylaşım linki güvenle reddedilir, veri değişmez', async ({ page }) => {
  await seed(page, JSON.stringify(defaultState()))
  await page.goto('./#/share/bozuk-link')
  await expect(page.getByRole('alert')).toContainText('Link bozuk')
  await expect(page.getByRole('button', { name: 'Rutinlerime ekle' })).toHaveCount(0)
  expect((await readState(page)).routines).toEqual([])
})
