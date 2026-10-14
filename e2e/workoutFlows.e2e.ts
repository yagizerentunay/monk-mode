import { expect, test, type Page } from '@playwright/test'
import { defaultState, type ExCfg, type State } from '../src/store/schema.ts'
import { BENCH, readState, seed } from './seed.ts'

const CURL = 'Dumbbell_Bicep_Curl'
const DB_PRESS = 'Dumbbell_Bench_Press'
const PULLUP = 'Pullups'

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

function stateWith(ex: ExCfg[], patch: Partial<State> = {}): State {
  return { ...defaultState(), routines: [{ id: 'r1', name: 'E2E Akış', ex }], ...patch }
}

async function startRoutine(page: Page, state: State): Promise<void> {
  await seed(page, JSON.stringify(state))
  // "N set tamamlanmadı, yine de bitirilsin mi?" onayı.
  page.on('dialog', (d) => void d.accept())
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Akış/ }).click()
}

/** İsimli set satırı (Set 1, Isınma 1, Drop 1…). */
const setRow = (page: Page, name: string) =>
  page.locator('.set').filter({ has: page.getByRole('textbox', { name: `${name} ağırlık`, exact: true }) })

test('tek taraflı set: sayaç iki taraf da bitince başlar, taraflar ayrı kaydedilir', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(CURL, { sets: 1, reps: 10, weight: 12, side: true })]))

  await page.getByRole('textbox', { name: 'Set 1 Sağ tekrar' }).fill('8')
  await page.getByRole('button', { name: 'Sol tarafı tamamla' }).click()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.getByRole('button', { name: 'Sağ tarafı tamamla' }).click()
  await expect(page.getByRole('timer')).toBeVisible()

  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()

  const [w] = (await readState(page)).workouts
  const set = w.entries[0].sets[0]
  expect(w.entries[0].unilateral).toBe(true)
  expect(set.sides).toEqual({ L: { r: 10, done: true }, R: { r: 8, done: true } })
  // Zayıf taraf ilerlemeyi belirler.
  expect(set).toMatchObject({ w: 12, r: 8, done: true })
})

test('seansta tek taraflıya geçince sol/sağ satırları açılır ve geri alınır', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(CURL, { sets: 1 })]))
  await expect(page.getByRole('textbox', { name: 'Set 1 Sol tekrar' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Tek taraflı (sol/sağ)' }).click()
  await expect(page.getByRole('textbox', { name: 'Set 1 Sol tekrar' })).toBeVisible()
  await page.getByRole('button', { name: 'Tek taraflı (sol/sağ)' }).click()
  await expect(page.getByRole('textbox', { name: 'Set 1 tekrar' })).toBeVisible()
})

test('ısınma ve dropset: çalışma ağırlığından hesaplanır, kayıtta işaretli ve ısınma hacme girmez', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 1, reps: 5, weight: 100 })]))

  await page.getByRole('button', { name: '+ Isınma' }).click()
  await expect(page.getByRole('textbox', { name: 'Isınma 1 ağırlık' })).toHaveValue('40')

  await setRow(page, 'Set 1').getByRole('button', { name: 'Seti tamamla' }).click()
  await page.getByRole('button', { name: 'Set 1 sonrası dropset ekle' }).click()
  await expect(page.getByRole('textbox', { name: 'Drop 1 ağırlık' })).toHaveValue('80')
  await setRow(page, 'Drop 1').getByRole('button', { name: 'Seti tamamla' }).click()
  await setRow(page, 'Isınma 1').getByRole('button', { name: 'Seti tamamla' }).click()

  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  // Hacim yalnız çalışma seti + drop: 100×5 + 80×5 = 900 (ısınma sayılmaz).
  await expect(page.locator('.wk-stats')).toContainText('900')

  const [w] = (await readState(page)).workouts
  expect(w.entries[0].sets.map((s) => ({ w: s.w, warmup: !!s.warmup, drop: !!s.drop }))).toEqual([
    { w: 40, warmup: true, drop: false },
    { w: 100, warmup: false, drop: false },
    { w: 80, warmup: false, drop: true },
  ])
})

test('süperset: partner bekliyorsa dinlenme yok, tur sonunda başlar', async ({ page }) => {
  await startRoutine(
    page,
    stateWith([cfg(BENCH, { sets: 2 }), cfg(CURL, { sets: 2, weight: 12, superset: true })]),
  )
  await expect(page.getByText(/Süperset A1/)).toBeVisible()

  await setRow(page, 'Set 1').first().getByRole('button', { name: 'Seti tamamla' }).click() // bench 1 → partner bekliyor
  await expect(page.getByRole('timer')).toHaveCount(0)
  await setRow(page, 'Set 1').nth(1).getByRole('button', { name: 'Seti tamamla' }).click() // curl 1 → tur bitti
  await expect(page.getByRole('timer')).toBeVisible()
})

test('RIR: set başına girilir, özet eksik RIR kartıyla toplu doldurulur', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 2, reps: 5, weight: 60 })]))

  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  await page.getByRole('button', { name: 'Set 1 RIR 2' }).click()
  await expect(page.getByRole('button', { name: 'Set 1 RIR 2' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Seti tamamla' }).first().click()
  // İkinci setin RIR'i boş: "Aynı (2)" önerisi çıkar ama kendiliğinden yazılmaz.
  await expect(page.getByRole('button', { name: /Set 2 RIR önceki set gibi 2/ })).toBeVisible()

  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('RIR eksik: 1 set')).toBeVisible()
  await expect(page.getByText('RIR girilen set oranı: %50')).toBeVisible()
  await page.getByRole('button', { name: /1 setin hepsine RIR 3 yaz/ }).click()
  await expect(page.getByText('RIR girilen set oranı: %100')).toBeVisible()

  const [w] = (await readState(page)).workouts
  expect(w.entries[0].sets.map((s) => s.rir)).toEqual([2, 3])
})

test('not kaydedilir ve aynı egzersizin sonraki seansında hatırlatılır', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 1, reps: 5, weight: 60 })]))
  await page.getByRole('button', { name: 'Not', exact: true }).click()
  await page.getByRole('textbox', { name: /notu$/ }).fill('sol omuz sıkıştı')
  await page.getByRole('button', { name: 'Seti tamamla' }).click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  expect((await readState(page)).workouts[0].entries[0].note).toBe('sol omuz sıkıştı')

  await page.getByRole('button', { name: 'Ana sayfaya dön' }).click()
  // Yönlendirme tamamlanmadan hash'i değiştirmek özet ekranını açık bırakır; Ana sayfa görününceye kadar bekle.
  await expect(page.locator('.home')).toBeVisible()
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Akış/ }).click()
  await expect(page.getByText(/sol omuz sıkıştı/)).toBeVisible()
})

test('plaka hesaplayıcı: 100 kg taraf başına 25 + 15', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 1, reps: 5, weight: 100 })]))
  await page.getByRole('button', { name: 'Plakalar' }).click()
  await expect(page.locator('.platetext')).toContainText('25')
  await expect(page.locator('.platetext')).toContainText('15')
  await expect(page.getByText(/Bar 20 kg · yük 100 kg/)).toBeVisible()
})

test('lb birimi: gösterim dönüşür, girilen değer kg olarak saklanır', async ({ page }) => {
  const s = stateWith([cfg(BENCH, { sets: 1, reps: 5, weight: 60 })])
  s.settings.unit = 'lb'
  await startRoutine(page, s)
  // 60 kg ≈ 132,28 lb.
  const field = page.getByRole('textbox', { name: 'Set 1 ağırlık' })
  await expect(field).toHaveValue('132,28')
  await field.fill('135')
  await page.getByRole('button', { name: 'Seti tamamla' }).click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  const w = (await readState(page)).workouts[0]
  expect(w.entries[0].sets[0].w).toBeCloseTo(61.23, 1)
})

test('egzersiz değiştir: seçilen egzersizle değişir, rutin değişmez', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 2, reps: 5, weight: 60 })]))
  await page.getByRole('button', { name: 'Değiştir' }).click()
  await page.getByRole('dialog').locator('.exrow').filter({ hasText: 'Dumbbell Bench Press' }).first().click()
  await expect(page.locator('.exhead')).toHaveText('Dumbbell Bench Press')
  await expect(page.getByRole('button', { name: 'Seti tamamla' })).toHaveCount(2)
  const s = await readState(page)
  expect(s.routines[0].ex[0].exId).toBe(BENCH)
  expect(s.active?.entries[0].exId).toBe(DB_PRESS)
})

test('sıfır ağırlık uyarısı: barbell setinde 0 kg uyarılır, düzelince kaybolur', async ({ page }) => {
  await startRoutine(page, stateWith([cfg(BENCH, { sets: 1, reps: 5, weight: 0 })]))
  await page.getByRole('button', { name: 'Seti tamamla' }).click()
  await expect(page.getByRole('note').filter({ hasText: 'Ağırlık 0 görünüyor' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Set 1 ağırlık' }).fill('20')
  await expect(page.getByRole('note').filter({ hasText: 'Ağırlık 0 görünüyor' })).toHaveCount(0)
})

test('vücut ağırlığı egzersizi: ek yük + vücut ağırlığı toplam yük olarak gösterilir', async ({ page }) => {
  const s = stateWith([cfg(PULLUP, { sets: 1, reps: 6, weight: 10, bw: true })], {
    bodyweight: [{ d: new Date().toLocaleDateString('sv-SE'), w: 80 }],
  })
  await startRoutine(page, s)
  await expect(page.getByText('Toplam 90 kg')).toBeVisible()
  await page.getByRole('textbox', { name: 'Set 1 ek yük' }).fill('-20')
  await expect(page.getByText('Toplam 60 kg')).toBeVisible()
})
