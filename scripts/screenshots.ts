/// <reference lib="dom" />
// README ekran görüntülerini ve demo GIF'ini yeniden üretir: `npm run screenshots`.
// Üretim derlemesini `vite preview` ile açar, örnek veriyi (scripts/demo-data.ts) localStorage'a yazar ve
// sabit saatle telefon boyutunda çeker; çıktı public/screenshots/ altına gider.
// `--no-build` derlemeyi atlar, `--no-gif` GIF'i atlar. GIF için PATH'te ffmpeg gerekir; yoksa atlanır.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { DEMO_TODAY, demoState } from './demo-data.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'public', 'screenshots')
const PORT = 4183
const BASE = `http://localhost:${PORT}/`
const STORAGE_KEY = 'monk_state_v1'
const VIEWPORT = { width: 390, height: 844 }
/** Görüntülerdeki an: demo gününün akşamı, antrenman saati (Istanbul, UTC+3). */
const NOW = new Date(`${DEMO_TODAY}T18:30:00+03:00`)

const args = new Set(process.argv.slice(2))

function run(command: string, commandArgs: string[]): void {
  const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(' ')} başarısız (${result.status})`)
}

async function startPreview(): Promise<ChildProcess> {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return server
    } catch {
      // sunucu henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  server.kill()
  throw new Error(`vite preview ${BASE} adresinde açılmadı`)
}

function stopPreview(server: ChildProcess): void {
  // Windows'ta `shell: true` ile açılan süreç ağacı yalnız taskkill ile kapanır.
  if (process.platform === 'win32' && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}

async function newContext(browser: Browser, video?: string, colorScheme: 'dark' | 'light' = 'dark'): Promise<BrowserContext> {
  return browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Demo verisinde tema "Sistem"; görüntünün teması bu renk şemasından gelir.
    colorScheme,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    // Service worker önbelleği eski paketi göstermesin.
    serviceWorkers: 'block',
    ...(video ? { recordVideo: { dir: video, size: VIEWPORT } } : {}),
  })
}

async function openWithDemo(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.clock.install({ time: NOW })
  await page.goto(BASE)
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(demoState())] as const)
  await page.reload()
  return page
}

async function go(page: Page, hash: string): Promise<void> {
  await page.goto(`${BASE}#${hash}`)
  await page.waitForLoadState('networkidle')
}

/** Başlığı taşıyan kartı ekranın üstüne kaydırır. */
async function scrollToCard(page: Page, heading: string): Promise<void> {
  await page.getByRole('heading', { name: heading, exact: true }).evaluate((el) => {
    const card = el.closest('.card') ?? el
    card.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -16)
  })
}

async function waitForImages(page: Page): Promise<void> {
  await page.waitForFunction(() => [...document.images].every((img) => img.complete))
}

async function shot(page: Page, name: string): Promise<void> {
  await waitForImages(page)
  // Kaydırma çubuğu ve geçiş animasyonları otursun.
  await page.waitForTimeout(400)
  const path = join(OUT, `${name}.png`)
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' })
  console.log(`  ${name}.png  ${Math.round(statSync(path).size / 1024)} KB`)
}

/** Push rutinini başlatır, saati 14 dk ilerletir, iki ısınmayı ve ilk çalışma setini RIR 2 ile tamamlar: dinlenme sayacı akıyor. */
async function startPushWithFirstSet(page: Page): Promise<void> {
  await go(page, '/workout')
  await page.getByRole('button', { name: /^Push/ }).click()
  // Antrenman saati 0:00'da kalmasın.
  await page.clock.fastForward('14:20')
  const complete = page.getByRole('button', { name: 'Seti tamamla' })
  for (let i = 0; i < 3; i++) await complete.first().click()
  await page.getByRole('button', { name: /RIR 2$/ }).first().click()
}

async function screenshots(browser: Browser): Promise<void> {
  const context = await newContext(browser)
  const page = await openWithDemo(context)

  await go(page, '/')
  await shot(page, 'home')

  await go(page, '/stats')
  await shot(page, 'stats')
  await scrollToCard(page, 'Rekorlar')
  await shot(page, 'records')
  await scrollToCard(page, 'Antrenman sıklığı')
  await shot(page, 'heatmap')
  await scrollToCard(page, 'Kas haritası')
  await shot(page, 'muscles')
  await scrollToCard(page, 'Hedefler')
  await shot(page, 'goals')
  await scrollToCard(page, 'Ölçüler')
  await shot(page, 'measurements')

  await go(page, '/library')
  await shot(page, 'exercise-library')

  await go(page, '/plan')
  await page.getByRole('region', { name: 'Antrenman bloğu' }).evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -16)
  })
  await shot(page, 'block')

  await page.getByRole('tab', { name: 'Rutinler' }).click()
  await page.getByRole('button', { name: 'Başlangıç şablonları' }).click()
  await page.getByRole('dialog').waitFor()
  await shot(page, 'templates')
  await page.keyboard.press('Escape')

  await go(page, '/plan/r/demo-push')
  await page.getByRole('button', { name: 'Rutini paylaş' }).click()
  await page.getByRole('img', { name: /QR kodu/ }).waitFor()
  await shot(page, 'routine-share')
  await page.keyboard.press('Escape')

  await startPushWithFirstSet(page)
  await page.getByRole('timer').waitFor()
  await shot(page, 'workout')

  await context.close()

  const light = await newContext(browser, undefined, 'light')
  const lightPage = await openWithDemo(light)
  await go(lightPage, '/')
  await shot(lightPage, 'home-light')
  await light.close()
}

/** Antrenman akışını kaydedip GIF'e çevirir: set tamamla → RIR → sayaç → bitir → özet. */
async function demoGif(browser: Browser): Promise<void> {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status !== 0) {
    console.warn('  ffmpeg bulunamadı; demo.gif atlandı')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'monk-gif-'))
  try {
    const context = await newContext(browser, dir)
    const recordStart = Date.now()
    const page = await openWithDemo(context)
    const pause = (ms: number) => page.waitForTimeout(ms)

    await go(page, '/')
    await waitForImages(page)
    // Kayıt sayfa açılınca başlar; veri yükleme ve yeniden yükleme kısmı GIF'e girmesin.
    const skip = (Date.now() - recordStart) / 1000
    await pause(1200)
    await go(page, '/workout')
    await pause(600)
    await page.getByRole('button', { name: /^Push/ }).click()
    await pause(900)
    const complete = page.getByRole('button', { name: 'Seti tamamla' })
    for (let i = 0; i < 3; i++) {
      await complete.first().click()
      await pause(500)
    }
    await page.getByRole('button', { name: /RIR 2$/ }).first().click()
    await pause(1800)
    await complete.first().click()
    await pause(500)
    await page.getByRole('button', { name: /önceki set gibi/ }).first().click()
    await pause(1500)
    // Yapılmamış setler için çıkan "Yine de bitirilsin mi?" onayı.
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Bitir ✓' }).click()
    await pause(3000)
    await go(page, '/stats')
    await pause(2000)

    const video = page.video()
    await context.close()
    const source = video ? await video.path() : join(dir, readdirSync(dir)[0])
    const gif = join(OUT, 'demo.gif')
    // İki geçişli palet: 12 fps, 300 px genişlik; README'de 280 px gösterilir.
    run('ffmpeg', [
      '-y', '-loglevel', 'error', '-ss', skip.toFixed(2), '-i', source,
      '-vf', '"fps=12,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4"',
      gif,
    ])
    console.log(`  demo.gif  ${Math.round(statSync(gif).size / 1024)} KB`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  if (!args.has('--no-build')) run('npm', ['run', 'build'])
  const server = await startPreview()
  const browser = await chromium.launch()
  try {
    console.log(`Ekran görüntüleri → ${OUT}`)
    await screenshots(browser)
    if (!args.has('--no-gif')) await demoGif(browser)
  } finally {
    await browser.close()
    stopPreview(server)
  }
}

await main()
