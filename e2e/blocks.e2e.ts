import { expect, test } from '@playwright/test'
import { BENCH, readState, seed, stateWithRoutine } from './seed.ts'

const DAY = 24 * 60 * 60 * 1000
const SQUAT = 'Barbell_Squat'

function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Yedek hatırlatması bu testlerin konusu değil: yeni yedek alınmış gibi. */
function base() {
  const s = stateWithRoutine()
  s.settings.lastBackupAt = Date.now()
  return s
}

test('Plan’da blok başlatılır; deload haftasında Ana Sayfa uyarır, antrenman ekranı set azaltmayı önerir', async ({ page }) => {
  await seed(page, JSON.stringify(base()))
  await page.goto('./#/plan')

  const card = page.getByRole('region', { name: 'Antrenman bloğu' })
  await card.getByRole('button', { name: 'Blok başlat' }).click()
  await page.getByLabel('Başlangıç günü').fill(dayOf(Date.now()))
  await page.getByRole('radio', { name: '4 hafta' }).click()
  await page.getByLabel('Deload haftası').selectOption('1')
  await page.getByRole('button', { name: 'Bloğu başlat' }).click()

  await expect(card).toContainText('1/4. hafta')
  await expect(card).toContainText('Deload: 1. hafta')
  const saved = (await readState(page)).block
  expect(saved).toMatchObject({ start: dayOf(Date.now()), weeks: 4, deload: 1 })

  await page.goto('./#/')
  await expect(page.getByText('Blok: 1/4. hafta')).toBeVisible()
  await expect(page.getByText('Bu hafta planlı deload')).toBeVisible()
  await expect(page.locator('.card.banner').filter({ hasText: 'Bu hafta planlı deload' })).toContainText('%40–50')

  // Antrenman ekranı: 2 çalışma setli egzersizde 1 set önerilir; setler otomatik değişmez.
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  await expect(page.getByText('Deload haftası: 1 çalışma seti yeter (2 yerine), ağırlık aynı, RIR 4–5')).toBeVisible()
  expect((await readState(page)).active?.entries[0].sets).toHaveLength(2)
})

test('blok düzenlenir, bitirilir ve geçmişte görünür; iptal edilen blok "İptal" olarak kalır', async ({ page }) => {
  const s = base()
  s.block = { id: 'b1', start: dayOf(Date.now() - 7 * DAY), weeks: 5, deload: 5 }
  await seed(page, JSON.stringify(s))
  await page.goto('./#/plan')

  const card = page.getByRole('region', { name: 'Antrenman bloğu' })
  await expect(card).toContainText('2/5. hafta')
  await card.getByRole('button', { name: 'Düzenle' }).click()
  await page.getByRole('radio', { name: '6 hafta' }).click()
  await page.getByRole('button', { name: 'Kaydet' }).click()
  await expect(card).toContainText('2/6. hafta')
  // Deload son haftadaydı: hafta sayısıyla birlikte kaydı.
  await expect(card).toContainText('Deload: 6. hafta')

  await card.getByRole('button', { name: 'Bitir' }).click()
  await expect(card.getByRole('button', { name: 'Blok başlat' })).toBeVisible()
  await expect(card).toContainText('Geçmiş bloklar')
  await expect(card.locator('li')).toContainText('Bitti')

  await card.getByRole('button', { name: 'Blok başlat' }).click()
  await page.getByRole('button', { name: 'Bloğu başlat' }).click()
  page.once('dialog', (d) => void d.accept())
  await card.getByRole('button', { name: 'İptal et' }).click()
  await expect(card.locator('li')).toHaveCount(2)
  await expect(card.locator('li').first()).toContainText('İptal')

  const st = await readState(page)
  expect(st.block).toBeNull()
  expect(st.pastBlocks.map((b) => b.outcome)).toEqual(['done', 'cancelled'])
  expect(st.pastBlocks[0]).toMatchObject({ id: 'b1', weeks: 6, deload: 6 })
})

test('otomatik deload önerisinden deload bu haftaya planlanır; öneri bir daha sormaz', async ({ page }) => {
  const s = base()
  const now = Date.now()
  s.workouts = [100, 100, 100, 100, 85, 85].map((w, i) => {
    // Son iki düşük seans 1 ve 3 gün önce: öneri "şimdi" geçerli.
    const t = now - (1 + (5 - i) * 2) * DAY
    return {
      id: `d${i}`,
      d: dayOf(t),
      start: t,
      end: t + 3_600_000,
      name: 'Eski',
      entries: [BENCH, SQUAT].map((exId) => ({ exId, sets: [{ w, r: 5, done: true }] })),
    }
  })
  // Süren blok 3. haftasında; deload son haftada planlı.
  s.block = { id: 'b1', start: dayOf(now - 14 * DAY), weeks: 5, deload: 5 }
  await seed(page, JSON.stringify(s))
  await page.goto('./#/')

  const hint = page.locator('.card.banner').filter({ hasText: 'Toparlanma molası?' })
  await expect(hint).toBeVisible()
  await expect(page.getByText('Blok: 3/5. hafta')).toBeVisible()
  await hint.getByRole('button', { name: "Deload'u bu haftaya planla" }).click()

  await expect(hint).toBeHidden()
  await expect(page.getByText('Blok: 3/5. hafta')).toBeVisible()
  await expect(page.getByText('Bu hafta planlı deload')).toBeVisible()
  const st = await readState(page)
  expect(st.block).toMatchObject({ id: 'b1', deload: 3 })
  // Susturma ayrı bir mekanizma: planlamak ona dokunmaz.
  expect(st.settings.deloadSnoozedUntil).toBeUndefined()

  await page.reload()
  await expect(page.getByText('Bu hafta planlı deload')).toBeVisible()
  await expect(page.getByText('Toparlanma molası?')).toBeHidden()
})
