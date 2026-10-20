import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { defaultState, type State } from '../src/store/schema.ts'
import { BENCH, CATALOG_SIZE, readState, seed } from './seed.ts'

const STRONG_CSV = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '2026-10-05 18:00:00,Push Day,1h 5m,Bench Press (Barbell),1,60,8,0,0,,,',
  '2026-10-05 18:00:00,Push Day,1h 5m,Bench Press (Barbell),2,60,7,0,0,,,',
  '2026-10-05 18:00:00,Push Day,1h 5m,Bench Press (Barbell),3,62.5,5,0,0,,,',
  '2026-10-05 18:00:00,Push Day,1h 5m,Zzz Yeni Hareket,1,20,10,0,0,,,',
].join('\n')

const HEVY_CSV = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  '"A Günü","1 Eki 2026, 19:52","1 Eki 2026, 21:26","","Incline Bench Press (Dambıl)",,,0,normal,22.5,8,,,',
  '"A Günü","1 Eki 2026, 19:52","1 Eki 2026, 21:26","","Incline Bench Press (Dambıl)",,,1,normal,22.5,8,,,',
  '"A Günü","1 Eki 2026, 19:52","1 Eki 2026, 21:26","","Barfiks",,,0,normal,0,7,,,',
].join('\n')

async function pickCsv(page: Page, csv: string): Promise<void> {
  await page
    .locator('input[type=file][accept=".csv,text/csv"]')
    .setInputFiles({ name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') })
}

test('Strong CSV: önizleme, birim seçimi, içe aktarma ve tekrar yüklemede kopya oluşmaz', async ({ page }) => {
  await seed(page, JSON.stringify(defaultState()))
  await page.goto('./#/settings')

  await pickCsv(page, STRONG_CSV)
  const card = page.locator('.importcard')
  await expect(card.getByText('Strong', { exact: true })).toBeVisible()
  // Başlıkta birim yok: kullanıcıya sorulur ve uyarı çıkar.
  await expect(card.getByText(/Dosya ağırlık birimini söylemiyor/)).toBeVisible()
  await card.getByRole('button', { name: 'kg', exact: true }).click()
  await card.getByRole('button', { name: 'İçe aktar' }).click()
  await expect(card.getByRole('status')).toContainText(/1 antrenman/)

  let state = await readState(page)
  expect(state.workouts).toHaveLength(1)
  const w = state.workouts[0]
  expect(w.d).toBe('2026-10-05')
  expect(w.entries.reduce((n, e) => n + e.sets.length, 0)).toBe(4)
  expect(w.entries[0].sets[2]).toMatchObject({ w: 62.5, r: 5, done: true })
  // Eşleşmeyen hareket kullanıcının özel egzersizi olur; yanlış egzersize yazılmaz.
  expect(state.customEx.map((c) => c.name)).toContain('Zzz Yeni Hareket')

  // Aynı dosya ikinci kez: kopya yok.
  await pickCsv(page, STRONG_CSV)
  await expect(card.getByText(/zaten kayıtlı/)).toBeVisible()
  // Eklenecek yeni antrenman kalmadı: düğme devre dışıdır.
  await expect(card.getByRole('button', { name: 'İçe aktar' })).toBeDisabled()
  state = await readState(page)
  expect(state.workouts).toHaveLength(1)
})

test('Hevy CSV (Türkçe ay adları ve adlar): tarih ve süre doğru okunur', async ({ page }) => {
  await seed(page, JSON.stringify(defaultState()))
  await page.goto('./#/settings')

  await pickCsv(page, HEVY_CSV)
  const card = page.locator('.importcard')
  await expect(card.getByText('Hevy', { exact: true })).toBeVisible()
  await expect(card.getByText(/kg \(dosyadan\)/)).toBeVisible()
  await card.getByRole('button', { name: 'İçe aktar' }).click()

  const state = await readState(page)
  expect(state.workouts).toHaveLength(1)
  const w = state.workouts[0]
  expect(w.d).toBe('2026-10-01')
  expect(Math.round(((w.end ?? 0) - w.start) / 60_000)).toBe(94)
  expect(w.entries.map((e) => e.sets.length)).toEqual([2, 1])
})

test('geçersiz CSV anlaşılır hata verir ve veriyi değiştirmez', async ({ page }) => {
  const s = defaultState()
  s.bodyweight = [{ d: '2026-10-01', w: 80 }]
  await seed(page, JSON.stringify(s))
  await page.goto('./#/settings')
  await pickCsv(page, 'bu,bir,csv,degil\n1,2,3,4')
  await expect(page.locator('.importcard').getByRole('status')).toBeVisible()
  expect((await readState(page)).bodyweight).toEqual([{ d: '2026-10-01', w: 80 }])
})

test('yedek: dosyaya kaydedilir, her şey sıfırlanır, aynı dosyadan geri yüklenir', async ({ page }) => {
  const s: State = {
    ...defaultState(),
    routines: [{ id: 'r1', name: 'Yedek Rutin', ex: [{ exId: BENCH, sets: 2, reps: 5, weight: 60, prog: 'off', inc: 2.5, repsMax: 8 }] }],
    bodyweight: [{ d: '2026-10-01', w: 81.5 }],
    workouts: [
      {
        id: 'w1',
        d: '2026-10-02',
        start: Date.UTC(2026, 9, 2, 10),
        end: Date.UTC(2026, 9, 2, 11),
        routineId: 'r1',
        name: 'Yedek Rutin',
        entries: [{ exId: BENCH, sets: [{ w: 60, r: 5, done: true, rir: 2 }] }],
      },
    ],
  }
  await seed(page, JSON.stringify(s))
  page.on('dialog', (d) => void d.accept())
  await page.goto('./#/settings')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Yedeği kaydet (JSON)' }).click()
  const download = await downloading
  const path = await download.path()
  expect(download.suggestedFilename()).toMatch(/\.json$/)
  const saved = JSON.parse(readFileSync(path, 'utf-8'))
  expect(saved.workouts ?? saved.state?.workouts).toHaveLength(1)

  await page.getByRole('button', { name: 'Her şeyi sıfırla' }).click()
  await expect(page.getByText('Tüm veriler sıfırlandı.')).toBeVisible()
  expect((await readState(page)).workouts).toHaveLength(0)

  await page.locator('input[type=file][accept="application/json,.json"]').first().setInputFiles(path)
  await expect(page.getByText(/Yedek yüklendi: 1 antrenman, 1 rutin/)).toBeVisible()
  const after = await readState(page)
  expect(after.workouts[0]).toMatchObject({ id: 'w1', d: '2026-10-02' })
  expect(after.workouts[0].entries[0].sets[0]).toMatchObject({ w: 60, r: 5, rir: 2 })
  expect(after.routines[0].name).toBe('Yedek Rutin')
  expect(after.bodyweight).toEqual([{ d: '2026-10-01', w: 81.5 }])
})

test('tercihler: birim lb olunca ana sayfa ve plaka kiti lb gösterir; hafta başlangıcı planı yeniden dizer', async ({ page }) => {
  const s = defaultState()
  s.bodyweight = [{ d: new Date().toLocaleDateString('sv-SE'), w: 80 }]
  await seed(page, JSON.stringify(s))
  await page.goto('./#/')
  await expect(page.locator('.bignum.bw')).toHaveText('80 kg')

  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'lb', exact: true }).first().click()
  await expect(page.getByRole('textbox', { name: 'Bar ağırlığı' })).toHaveValue('45')
  await page.goto('./#/')
  await expect(page.locator('.bignum.bw')).toHaveText('176,4 lb')

  // Hafta başlangıcı Pazar: plan listesinin ilk günü Pazar olur.
  await page.goto('./#/settings')
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Cumartesi' }) }).selectOption('0')
  await page.goto('./#/plan')
  await expect(page.locator('.dayrow').first()).toHaveAttribute('aria-label', 'Pazar')
  expect((await readState(page)).settings).toMatchObject({ unit: 'lb', weekStart: 0 })
})

test('kütüphane: filtreler daraltır, özel egzersiz eklenir ve aranabilir, kas düzeltmesi kalıcıdır', async ({ page }) => {
  await seed(page, JSON.stringify(defaultState()))
  await page.goto('./#/library')
  await expect(page.getByText(`${CATALOG_SIZE} egzersiz`)).toBeVisible()

  await page.getByRole('button', { name: 'Göğüs', exact: true }).click()
  const chestCount = await page.locator('.resultcount').innerText()
  expect(chestCount).not.toBe(`${CATALOG_SIZE} egzersiz`)
  await page.getByRole('button', { name: 'Tüm kaslar' }).click()

  // Özel egzersiz.
  await page.getByRole('button', { name: '+ Özel' }).click()
  await page.getByPlaceholder('Egzersiz adı').fill('Zzz Kablo Çekiş')
  await page.getByLabel('Ana kas').selectOption('chest')
  await page.getByRole('button', { name: 'Ekle', exact: true }).click()
  await page.getByPlaceholder('Egzersiz ara…').fill('zzz kablo')
  await expect(page.locator('.exname', { hasText: 'Zzz Kablo Çekiş' })).toBeVisible()

  // Kas düzeltmesi: detaydan aç, kayıt sonrası "kaslar düzeltildi" görünür, orijinale dön siler.
  await page.getByPlaceholder('Egzersiz ara…').fill('lat pulldown')
  await page.locator('.exrow', { has: page.locator('.exname', { hasText: /^Lat Pulldown$/ }) }).click()
  await page.getByRole('button', { name: 'Kasları düzelt' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Kaydet' }).click()
  const s1 = await readState(page)
  // Hiçbir şey değiştirilmediyse düzeltme kaydı oluşmaz.
  expect(Object.keys(s1.muscleFix)).toEqual([])
})
