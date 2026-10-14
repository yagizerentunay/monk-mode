import { expect, test, type Page } from '@playwright/test'
import { defaultState, type State, type Workout } from '../src/store/schema.ts'
import { BENCH, readState, seed, stateWithRoutine } from './seed.ts'

function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

const ROUTES = ['#/', '#/plan', '#/stats', '#/library', '#/settings', '#/workout']

async function crawl(page: Page): Promise<void> {
  for (const route of ROUTES) {
    await page.goto(`./${route}`)
    await page.locator('main.app').filter({ hasText: /./ }).first().waitFor()
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${route} yatay taşıyor`).toBeLessThanOrEqual(0)
  }
}

test('antrenman ortasında sayfa yenilenince değerler, tamamlanan set ve dinlenme sayacı korunur', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, JSON.stringify(stateWithRoutine()))
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()

  await page.getByRole('textbox', { name: 'Set 1 ağırlık' }).fill('72.5')
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await expect(page.getByRole('timer')).toBeVisible()

  await page.reload()
  await expect(page.locator('.wk-title')).toHaveText('E2E Push')
  await expect(page.getByRole('textbox', { name: 'Set 1 ağırlık' })).toHaveValue('72,5')
  await expect(page.getByRole('button', { name: 'Seti geri al' })).toHaveCount(1)
  await expect(page.getByRole('timer')).toBeVisible()

  await page.goto('./#/')
  await expect(page.getByRole('link', { name: /Devam et/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('sarkan referanslar uygulamayı bozmaz: silinmiş rutin, bilinmeyen egzersiz, boş antrenman', async ({ page }) => {
  const errors = trackErrors(page)
  const s: State = {
    ...defaultState(),
    routines: [
      { id: 'r1', name: 'Gerçek', ex: [{ exId: 'Bu_Egzersiz_Yok', sets: 2, reps: 5, weight: 20, prog: 'double', inc: 2.5, repsMax: 8 }] },
    ],
    week: { 0: 'hayalet', 1: 'r1', 2: 'r1', 3: 'hayalet' },
    workouts: [
      {
        id: 'w1',
        d: '2026-10-01',
        start: Date.UTC(2026, 9, 1, 10),
        end: Date.UTC(2026, 9, 1, 11),
        routineId: 'silinmis-rutin',
        name: 'Eski',
        entries: [
          { exId: 'Bu_Egzersiz_Yok', sets: [{ w: 20, r: 5, done: true }] },
          { exId: BENCH, sets: [] },
        ],
      },
      { id: 'w2', d: '2026-10-02', start: Date.UTC(2026, 9, 2, 10), name: 'Boş', entries: [] },
    ],
  }
  await seed(page, JSON.stringify(s))
  await crawl(page)

  // Bilinmeyen egzersizli rutin yine başlatılabilir ve bitirilebilir.
  page.on('dialog', (d) => void d.accept())
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /Gerçek/ }).click()
  await expect(page.getByText('Bu_Egzersiz_Yok')).toBeVisible()
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  expect(errors).toEqual([])
})

test('600 antrenmanlık geçmiş hızlı açılır ve kayıt 5 MB sınırının çok altında kalır', async ({ page }) => {
  const errors = trackErrors(page)
  const s = defaultState()
  s.routines = [{ id: 'r1', name: 'Büyük', ex: [{ exId: BENCH, sets: 3, reps: 8, weight: 60, prog: 'double', inc: 2.5, repsMax: 12 }] }]
  const base = Date.UTC(2023, 0, 2, 10)
  s.workouts = Array.from({ length: 600 }, (_, i): Workout => {
    const start = base + i * 2 * 86_400_000
    return {
      id: `w${i}`,
      d: new Date(start).toISOString().slice(0, 10),
      start,
      end: start + 3_600_000,
      routineId: 'r1',
      name: 'Büyük',
      entries: ['bench', BENCH, 'Barbell_Curl', 'Pullups', 'Pushups', 'Dumbbell_Bench_Press'].map((exId) => ({
        exId,
        sets: Array.from({ length: 4 }, (_, k) => ({ w: 40 + (i % 30) + k, r: 8, done: true, rir: 2 })),
      })),
    }
  })
  s.bodyweight = Array.from({ length: 300 }, (_, i) => ({ d: new Date(base + i * 3 * 86_400_000).toISOString().slice(0, 10), w: 80 + (i % 7) / 10 }))
  const raw = JSON.stringify(s)
  expect(raw.length).toBeLessThan(2_000_000)
  await seed(page, raw)

  for (const route of ['#/', '#/stats', '#/plan']) {
    const t0 = Date.now()
    await page.goto(`./${route}`)
    await page.locator('main.app').filter({ hasText: /./ }).first().waitFor()
    await page.waitForLoadState('networkidle')
    expect(Date.now() - t0, `${route} açılış süresi`).toBeLessThan(5000)
  }
  await page.goto('./#/stats')
  await expect(page.locator('.statbig .bignum').first()).not.toHaveText('')
  expect((await readState(page)).workouts).toHaveLength(600)
  expect(errors).toEqual([])
})

test.describe('masaüstü genişliği', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('tüm sekmeler yatay taşmadan ve hatasız açılır', async ({ page }) => {
    const errors = trackErrors(page)
    await seed(page, JSON.stringify(stateWithRoutine()))
    await crawl(page)
    expect(errors).toEqual([])
  })
})

test.describe('küçük telefon (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('en dar ekranda hiçbir sekme yatay taşmaz', async ({ page }) => {
    const errors = trackErrors(page)
    await seed(page, JSON.stringify(stateWithRoutine()))
    await crawl(page)
    await page.goto('./#/workout')
    await page.getByRole('button', { name: /E2E Push/ }).click()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'antrenman ekranı yatay taşıyor').toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
})
