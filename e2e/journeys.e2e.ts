import { expect, test, type Page } from '@playwright/test'
import { defaultState, type State, type Workout } from '../src/store/schema.ts'
import { BENCH, readState, seed } from './seed.ts'

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

/** Yerel gün, YYYY-MM-DD (uygulamanın dayString'i ile aynı). */
function dayKey(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE')
}

function workout(id: string, d: string, sets: [number, number][]): Workout {
  const start = new Date(`${d}T10:00:00`).getTime()
  return {
    id,
    d,
    start,
    end: start + 3_600_000,
    routineId: 'r1',
    name: 'E2E Akış',
    entries: [{ exId: BENCH, sets: sets.map(([w, r]) => ({ w, r, done: true, rir: 2 })) }],
  }
}

function stateWithHistory(): State {
  const s = defaultState()
  s.routines = [
    { id: 'r1', name: 'E2E Akış', ex: [{ exId: BENCH, sets: 2, reps: 5, weight: 60, prog: 'off', inc: 2.5, repsMax: 8 }] },
  ]
  s.workouts = [
    workout('w1', dayKey(-10), [[50, 5], [50, 5]]),
    workout('w2', dayKey(-7), [[55, 5], [55, 5]]),
    workout('w3', dayKey(-3), [[60, 5], [60, 5]]),
  ]
  s.bodyweight = [
    { d: dayKey(-8), w: 80.4 },
    { d: dayKey(-1), w: 80 },
  ]
  return s
}

/** Sayfa hatalarını ve konsol hatalarını toplar; test sonunda boş olmalı. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

test('sıfırdan ilk antrenman: rutin kur, güne ata, başla, bitir, geçmişte ve analizde gör', async ({ page }) => {
  const errors = trackErrors(page)
  page.on('dialog', (d) => void d.accept())
  await page.goto('./')
  await expect(page.getByText('İlk rutinini kur, günlere ata.')).toBeVisible()

  // Rutin kur.
  await page.goto('./#/plan')
  await page.getByRole('tab', { name: 'Rutinler' }).click()
  await page.getByRole('button', { name: '+ Yeni rutin' }).click()
  await page.getByLabel('Rutin adı').fill('Üst Vücut')
  await page.getByRole('button', { name: '+ Egzersiz ekle' }).click()
  await page.getByPlaceholder('Egzersiz ara…').fill('bench press')
  await page.locator('.exrow', { has: page.locator('.exname', { hasText: /^Barbell Bench Press$/ }) }).click()
  await page.getByRole('textbox', { name: 'Set', exact: true }).fill('2')
  await page.getByRole('textbox', { name: 'Tekrar', exact: true }).fill('5')
  await page.getByRole('textbox', { name: /^Ağırlık/ }).fill('60')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await page.getByRole('tab', { name: 'Rutinler' }).click()
  await expect(page.locator('.routinecard', { hasText: 'Üst Vücut' })).toBeVisible()

  // Bugüne ata.
  await page.getByRole('tab', { name: 'Haftalık program' }).click()
  await page.getByRole('button', { name: DAY_NAMES[new Date().getDay()], exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Üst Vücut' }).click()
  await expect(page.locator('.dayrow.today .dayname')).toHaveText('Üst Vücut')

  // Ana sayfada bugünün antrenmanı; başla ve bitir.
  await page.goto('./#/')
  await expect(page.getByText('Bugünün antrenmanı')).toBeVisible()
  await page.getByRole('button', { name: 'Antrenmana başla' }).click()
  await expect(page.locator('.wk-title')).toHaveText('Üst Vücut')
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  await expect(page.locator('.wk-pr-item')).toHaveText('Barbell Bench Press') // ilk seans her zaman rekor

  // Ana sayfa: bugün tamamlandı, sayaçlar.
  await page.getByRole('button', { name: 'Ana sayfaya dön' }).click()
  await expect(page.getByText('✓ Bugün tamamlandı')).toBeVisible()
  await expect(page.locator('.stat', { hasText: 'toplam' })).toContainText('01')

  // Analiz: grafik değeri ve son antrenman satırı.
  await page.goto('./#/stats')
  // 60 kg × 5 için Epley tahmini 1RM = 70 kg.
  await expect(page.locator('.statbig .bignum').first()).toHaveText('70')
  await expect(page.getByRole('button', { name: /Üst Vücut/ })).toBeVisible()

  const s = await readState(page)
  expect(s.workouts).toHaveLength(1)
  expect(s.workouts[0].entries[0].sets).toHaveLength(2)
  expect(errors).toEqual([])
})

test('takvim: geçmiş güne rutinden antrenman kaydedilir ve düzeltilen değerler saklanır', async ({ page }) => {
  const errors = trackErrors(page)
  const s = stateWithHistory()
  s.workouts = []
  await seed(page, JSON.stringify(s))
  await page.goto('./#/')

  const target = dayKey(-1)
  await page.getByRole('button', { name: 'Takvim' }).click()
  const [, , dayNum] = target.split('-').map(Number)
  // Dünün ayı bugünkünden farklıysa (ayın 1'i) önceki aya geç.
  if (target.slice(0, 7) !== dayKey(0).slice(0, 7)) await page.getByRole('button', { name: 'Önceki ay' }).click()
  await page.locator('.calcell:not(.out)').filter({ hasText: new RegExp(`^${dayNum}$`) }).click()

  await page.getByRole('button', { name: 'Bu tarihe antrenman kaydet' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /E2E Akış/ }).click()
  await page.getByRole('textbox', { name: /Set 1 ağırlık$/ }).fill('70')
  await page.getByRole('button', { name: /Set 2 sil$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kaydet' }).click()

  // Gün görünümü kaydı listeler.
  await expect(page.getByRole('dialog').getByText('1 set · 350 kg')).toBeVisible()

  const state = await readState(page)
  expect(state.workouts).toHaveLength(1)
  expect(state.workouts[0].d).toBe(target)
  expect(state.workouts[0].entries[0].sets).toEqual([expect.objectContaining({ w: 70, r: 5, done: true })])
  expect(errors).toEqual([])
})

test('geçmiş antrenman düzenlenir: tekrar değişir, hacim ve ilerleme yeniden hesaplanır', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, JSON.stringify(stateWithHistory()))
  await page.goto('./#/stats')

  await page.locator('.exrow', { hasText: 'E2E Akış' }).first().click() // en yeni antrenman (w3: 60×5, 60×5)
  await page.getByRole('button', { name: 'Düzenle' }).click()
  await page.getByRole('textbox', { name: /Set 1 tekrar$/ }).fill('8')
  await page.getByRole('dialog').getByRole('button', { name: 'Kaydet' }).click()
  await expect(page.getByRole('dialog').getByText(/60×8/)).toBeVisible()

  const state = await readState(page)
  const edited = state.workouts.find((w) => w.id === 'w3')!
  expect(edited.entries[0].sets[0]).toMatchObject({ w: 60, r: 8 })
  expect(state.workouts.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']) // sıra ve kimlik korunur
  expect(errors).toEqual([])
})

test('kilo kaydı: bugünkü tartı yazılır, aynı gün tekrar yazılınca üzerine yazar', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, JSON.stringify(stateWithHistory()))
  await page.goto('./#/')

  const log = async (value: string) => {
    await page.locator('.card', { hasText: 'Vücut ağırlığı' }).getByRole('button', { name: 'Kaydet' }).first().click()
    await page.getByRole('textbox', { name: 'Ağırlık (kg)' }).fill(value)
    await page.getByRole('button', { name: 'kg olarak kaydet' }).click()
  }
  await log('79.4')
  await expect(page.locator('.bignum.bw')).toHaveText('79,4 kg')
  await log('79.1')
  await expect(page.locator('.bignum.bw')).toHaveText('79,1 kg')

  const bw = (await readState(page)).bodyweight
  expect(bw.filter((b) => b.d === dayKey(0))).toEqual([{ d: dayKey(0), w: 79.1 }])
  expect(bw).toHaveLength(3)
  expect(errors).toEqual([])
})

test('geçmişi olan kullanıcı tüm sekmeleri gezer: hata, taşma ve kırık görsel yok', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, JSON.stringify(stateWithHistory()))

  for (const route of ['#/', '#/plan', '#/stats', '#/library', '#/settings', '#/workout']) {
    await page.goto(`./${route}`)
    await page.locator('main.app').filter({ hasText: /./ }).first().waitFor()
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `${route} yatay taşıyor`).toBeLessThanOrEqual(0)
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
    )
    expect(broken, `${route} kırık görsel`).toEqual([])
  }
  expect(errors).toEqual([])
})
