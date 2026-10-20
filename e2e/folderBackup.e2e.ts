import { expect, test, type Page } from '@playwright/test'
import { readState, seed, stateWithRoutine } from './seed.ts'

const FOLDER = 'Yedekler'

/** Klasör seçiciyi tarayıcının kaynak-özel dosya sistemindeki (OPFS) bir klasörle taklit eder. */
async function stubFolderPicker(page: Page): Promise<void> {
  await page.addInitScript((name) => {
    const w = window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
    w.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
  }, FOLDER)
}

/** Klasördeki yedek dosyalarını (ad → ayrıştırılmış içerik) okur. */
async function readFolder(page: Page): Promise<Record<string, { app: string; state: { workouts: unknown[] } }>> {
  return page.evaluate(async (name) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true })
    const out: Record<string, unknown> = {}
    for await (const [fileName, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (handle.kind === 'file') out[fileName] = JSON.parse(await (await (handle as FileSystemFileHandle).getFile()).text())
    }
    return out as never
  }, FOLDER)
}

function stateWithOneWorkout(): string {
  const s = stateWithRoutine()
  const at = Date.now() - 86_400_000
  s.workouts = [{ id: 'w1', d: new Date(at).toISOString().slice(0, 10), start: at, end: at + 1_800_000, name: 'Eski', entries: [] }]
  return JSON.stringify(s)
}

test('klasör seçilince hemen yedek yazılır; antrenman bitince dosya sessizce güncellenir', async ({ page }) => {
  await stubFolderPicker(page)
  await seed(page, stateWithOneWorkout())
  await page.goto('./#/settings')

  await page.getByRole('button', { name: 'Klasör seç' }).click()
  await expect(page.getByText('✓ Klasöre yedeklendi.')).toBeVisible()
  await expect(page.getByText(FOLDER, { exact: true })).toBeVisible()

  const first = Object.entries(await readFolder(page))
  expect(first).toHaveLength(1)
  expect(first[0][0]).toMatch(/^monk-mode-otomatik-\d{4}-\d{2}-\d{2}\.json$/)
  expect(first[0][1].app).toBe('monk-mode')
  expect(first[0][1].state.workouts).toHaveLength(1)
  // Klasör yedeği "yedeklendi" sayılır: Ayarlar'daki son yedek zamanı doldu.
  expect((await readState(page)).settings.lastBackupAt).toBeGreaterThan(0)

  await page.goto('./#/workout')
  await page.getByRole('button', { name: /E2E Push/ }).click()
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  await complete.first().click()
  await complete.first().click()
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()

  await expect.poll(async () => Object.values(await readFolder(page))[0]?.state.workouts.length).toBe(2)
})

test('klasör seçimi yeniden yüklemeden sonra da durur; Kapat klasördeki dosyalara dokunmaz', async ({ page }) => {
  await stubFolderPicker(page)
  await seed(page, stateWithOneWorkout())
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Klasör seç' }).click()
  await expect(page.getByText('✓ Klasöre yedeklendi.')).toBeVisible()

  await page.reload()
  await expect(page.getByText(FOLDER, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Şimdi yedekle' }).click()
  await expect(page.getByText('✓ Klasöre yedeklendi.')).toBeVisible()

  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await expect(page.getByText('Klasör yedeği kapatıldı. Klasördeki dosyalar silinmedi.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Klasör seç' })).toBeVisible()
  expect(Object.keys(await readFolder(page))).toHaveLength(1)
})

test('veri yokken sessiz yedek yazılmaz (boş hâl iyi yedeğin üzerine yazılmasın)', async ({ page }) => {
  await stubFolderPicker(page)
  await seed(page, stateWithOneWorkout())
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Klasör seç' }).click()
  await expect(page.getByText('✓ Klasöre yedeklendi.')).toBeVisible()

  page.on('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Her şeyi sıfırla' }).click()
  expect((await readState(page)).workouts).toHaveLength(0)
  await page.reload()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

  const files = Object.values(await readFolder(page))
  expect(files).toHaveLength(1)
  expect(files[0].state.workouts).toHaveLength(1)
})
