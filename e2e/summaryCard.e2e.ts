import { copyFile, readFile } from 'node:fs/promises'
import { expect, test, type Download, type Page } from '@playwright/test'
import { defaultState, type Workout } from '../src/store/schema.ts'
import { BENCH, seed, stateWithRoutine } from './seed.ts'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Paylaşım menüsü olmayan tarayıcı: kart PNG olarak indirilmeli. */
async function withoutShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (Navigator.prototype as Partial<Navigator>).canShare
    delete (Navigator.prototype as Partial<Navigator>).share
  })
}

/** PNG'yi doğrular, boyutunu döner; `CARD_OUT` verilmişse gözle bakmak için oraya kopyalar. */
async function checkPng(file: Download, name: string): Promise<{ width: number; height: number }> {
  const path = (await file.path()) as string
  const bytes = await readFile(path)
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC)
  if (process.env.CARD_OUT) await copyFile(path, `${process.env.CARD_OUT}/${name}`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

test('bitiş özetinde Paylaş: paylaşım yoksa özet kartı PNG olarak iner', async ({ page }) => {
  await withoutShare(page)
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await complete.first().click()
  await complete.first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Paylaş' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^monk-mode-antrenman-\d{4}-\d{2}-\d{2}\.png$/)
  expect(await checkPng(file, 'finish.png')).toEqual({ width: 1080, height: 1350 })
  await expect(page.getByRole('status').filter({ hasText: 'Özet kartı indirildi.' })).toBeVisible()
})

test('geçmişteki antrenmanın detayından da kart paylaşılır', async ({ page }) => {
  await withoutShare(page)
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const day = (t: number) => new Date(t).toLocaleDateString('sv-SE')
  const sets = (w: number, r: number, n: number) => Array.from({ length: n }, () => ({ w, r, done: true }))
  const workouts: Workout[] = [
    { id: 'old', d: day(now - 7 * DAY), start: now - 7 * DAY, end: now - 7 * DAY + 40 * 60000, name: 'Üst Gövde', entries: [{ exId: BENCH, sets: sets(60, 5, 3) }] },
    {
      id: 'new',
      d: day(now - DAY),
      start: now - DAY,
      end: now - DAY + 74 * 60000,
      name: 'Üst Gövde',
      entries: [
        { exId: BENCH, sets: [{ w: 40, r: 10, done: true, warmup: true }, ...sets(62.5, 6, 3)] },
        { exId: 'Pullups', bw: true, sets: sets(0, 8, 3) },
        { exId: 'atlas:bodyweight-plank-to-downward-dog', timed: true, sets: [{ w: 0, r: 45, done: true }, { w: 0, r: 75, done: true }] },
      ],
    },
  ]
  const s = defaultState()
  s.workouts = workouts
  await seed(page, JSON.stringify(s))
  await page.goto('./#/stats')
  await page.locator('.exrow', { hasText: 'Üst Gövde' }).first().click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Pull-Up')

  const download = page.waitForEvent('download')
  await sheet.getByRole('button', { name: 'Paylaş' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe(`monk-mode-antrenman-${day(now - DAY)}.png`)
  const size = await checkPng(file, 'detail.png')
  expect(size.width).toBe(1080)
})
