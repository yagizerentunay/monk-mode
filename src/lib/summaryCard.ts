import type { Workout, WorkoutEntry } from '../store/schema.ts'
import { formatDayTitle } from './calendar.ts'
import { distanceTotals, formatDistanceSet } from './distance.ts'
import { effectiveLoad, formatLoadWithUnit, formatTimedLoad } from './load.ts'
import { setReps } from './sets.ts'
import { formatDuration } from './timed.ts'
import { formatWeight, type Unit } from './units.ts'
import { doneSetCount, hasVolume, isPR, workoutVolume } from './workout.ts'

/**
 * Antrenman özet kartı: biten (ya da geçmişteki) bir antrenmanı paylaşılabilir bir PNG'ye çizer.
 * Veri hazırlama (`buildCardData`, `fitText`) saf ve test edilir; çizim tarayıcının canvas'ına yapılır.
 * Dış istek yok: yazı tipi uygulamanın kendi Barlow Condensed dosyası, renkler CSS token'larından okunur.
 */

/** Kartta en fazla bu kadar hareket listelenir; fazlası "+N hareket daha" olur. */
export const MAX_CARD_EXERCISES = 6
/** Kartta en fazla bu kadar rekor listelenir; fazlası "+N rekor daha" olur. */
export const MAX_CARD_PRS = 3

export interface CardLine {
  name: string
  detail: string
}

export interface CardData {
  date: string
  title: string
  duration: string
  /** Hacme giren egzersiz yoksa (hepsi süreli) tanımsız. */
  volume?: string
  sets: number
  exercises: CardLine[]
  moreExercises: number
  prs: CardName[]
  morePrs: number
}

/** Egzersiz adı ve dili: kütüphane adları İngilizcedir, büyük harfe çevirirken Türkçe "İ" kuralı uygulanmaz. */
export interface CardName {
  name: string
  lang?: 'en'
}

export interface CardOptions {
  unit: Unit
  names: (exId: string) => string
  /** Bu antrenmanda rekor kırılan egzersizler. */
  prs: CardName[]
}

/** Seans süresi: bitiş özetindeki gibi en az 1 dk; bir saat ve üstü "1 sa 12 dk". */
export function formatSessionLength(workout: Workout): string {
  const mins = Math.max(1, Math.round(((workout.end ?? workout.start) - workout.start) / 60000))
  if (mins < 60) return `${mins} dk`
  const m = mins % 60
  return m === 0 ? `${Math.floor(mins / 60)} sa` : `${Math.floor(mins / 60)} sa ${m} dk`
}

/**
 * Bir hareketin tek satırlık özeti: tamamlanan çalışma seti sayısı ve en iyi set. Süreli harekette en
 * uzun tutuş saniyeyle ("45 sn", "1:30"), mesafe harekette toplam mesafe, süre ve tempo
 * ("5 km · 27:30 · 5:30 /km"), diğerlerinde en ağır set ("62,5 kg × 8").
 */
export function entryDetail(entry: WorkoutEntry, unit: Unit): string {
  const sets = entry.sets.filter((s) => s.done && !s.warmup)
  if (sets.length === 0) return 'Set yapılmadı'
  const count = `${sets.length} set`
  if (entry.distance) {
    const { m, sec } = distanceTotals(sets)
    const total = formatDistanceSet({ m, r: sec })
    return total ? `${count} · ${total}` : count
  }
  if (entry.timed) {
    const best = sets.reduce((a, b) => (setReps(b) > setReps(a) ? b : a))
    const load = formatTimedLoad(entry.bw, best.w, unit)
    return `${count} · ${load ? `${load} · ` : ''}${formatDuration(setReps(best))}`
  }
  const best = sets.reduce((a, b) => {
    const la = effectiveLoad(entry, a.w)
    const lb = effectiveLoad(entry, b.w)
    return lb > la || (lb === la && setReps(b) > setReps(a)) ? b : a
  })
  return `${count} · ${formatLoadWithUnit(entry.bw, best.w, unit)} × ${setReps(best)}`
}

/**
 * Geçmişteki bir antrenmanda rekor kırılan egzersizler: yalnız ondan önce başlamış antrenmanlarla
 * karşılaştırılır (bitiş özetindeki hesapla aynı: tamamlanan setler).
 */
export function prExIds(workouts: readonly Workout[], workout: Workout): string[] {
  const previous = workouts.filter((w) => w.id !== workout.id && w.start < workout.start)
  return workout.entries.filter((e) => isPR(previous, { ...e, sets: e.sets.filter((s) => s.done) })).map((e) => e.exId)
}

/** Karta çizilecek metinler. Hiç seti olmayan hareketler listelenmez. */
export function buildCardData(workout: Workout, opts: CardOptions): CardData {
  const lines = workout.entries
    .filter((e) => e.sets.some((s) => s.done && !s.warmup))
    .map((e) => ({ name: opts.names(e.exId), detail: entryDetail(e, opts.unit) }))
  // Aynı egzersiz seansta iki kez eklenmişse rekor bir kez yazılır.
  const prs = opts.prs.filter((p, i) => opts.prs.findIndex((q) => q.name === p.name) === i)
  return {
    date: formatDayTitle(workout.d),
    title: workout.name,
    duration: formatSessionLength(workout),
    volume: hasVolume(workout) ? `${formatWeight(workoutVolume(workout), opts.unit)} ${opts.unit}` : undefined,
    sets: doneSetCount(workout).done,
    exercises: lines.slice(0, MAX_CARD_EXERCISES),
    moreExercises: Math.max(0, lines.length - MAX_CARD_EXERCISES),
    prs: prs.slice(0, MAX_CARD_PRS),
    morePrs: Math.max(0, prs.length - MAX_CARD_PRS),
  }
}

/**
 * Metni `maxWidth` genişliğe sığdırır; sığmazsa sonunu kırpıp "…" ekler. `measure` canvas'ta
 * `ctx.measureText(t).width`tir; testte sabit genişlikli bir ölçü verilir.
 */
export function fitText(text: string, maxWidth: number, measure: (t: string) => number): string {
  if (measure(text) <= maxWidth) return text
  const chars = [...text]
  let lo = 0
  let hi = chars.length
  // Sığan en uzun önek (ikili arama); sondaki boşluk "…"dan önce atılır.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('').trimEnd() + '…') <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo === 0 ? '…' : chars.slice(0, lo).join('').trimEnd() + '…'
}

/** PNG dosya adı: monk-mode-antrenman-2026-10-06.png */
export function cardFileName(workout: Workout): string {
  return `monk-mode-antrenman-${workout.d}.png`
}

interface Palette {
  bg: string
  card: string
  line: string
  text: string
  muted: string
  accent: string
  accentSoft: string
}

/** Varsayılanlar `:root` ile aynı; token okunamazsa (test ortamı, eski tarayıcı) bunlar kullanılır. */
const FALLBACK: Palette = {
  bg: '#111315',
  card: '#202428',
  line: '#333b41',
  text: '#f5f2ec',
  muted: '#9aa1a6',
  accent: '#eb9462',
  accentSoft: 'rgba(235, 148, 98, 0.14)',
}

/** Renkleri o anki temanın CSS token'larından okur; ileride açık tema gelince kart da ona uyar. */
function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    bg: token('--bg', FALLBACK.bg),
    card: token('--card', FALLBACK.card),
    line: token('--line', FALLBACK.line),
    text: token('--text', FALLBACK.text),
    muted: token('--muted', FALLBACK.muted),
    accent: token('--accent', FALLBACK.accent),
    accentSoft: token('--accent-soft', FALLBACK.accentSoft),
  }
}

const W = 1080
const PAD = 80
const INNER = W - PAD * 2
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"
const BODY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const TILE_Y = 430
const TILE_H = 170
/** Hareket listesinin ilk satırından önceki taban çizgisi. */
const LIST_TOP = TILE_Y + TILE_H + 90 + 24
const ROW_H = 76
const PR_ROW_H = 58

/** Uygulamanın kendi yazı tipi yüklenmemişse yüklemeyi bekler; olmazsa yedek yazı tipiyle çizilir. */
async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all(['800 96px', '700 40px', '600 32px'].map((f) => document.fonts.load(`${f} 'Barlow Condensed'`, 'MONKŞĞİ')))
  } catch {
    // Yazı tipi yok: yedekle çizilir.
  }
}

/** Kartın yüksekliği içeriğe göre (en az 4:5); düzen sabitleri `drawSummaryCard` ile aynıdır. */
function cardHeight(data: CardData): number {
  const rows = Math.max(1, data.exercises.length) + (data.moreExercises > 0 ? 1 : 0)
  const prRows = data.prs.length + (data.morePrs > 0 ? 1 : 0)
  const listEnd = LIST_TOP + rows * ROW_H
  const end = prRows > 0 ? listEnd + 70 + 90 + prRows * PR_ROW_H : listEnd
  return Math.max(Math.round(W * 1.25), end + 200)
}

/** Monk Mode mührü (Brand.tsx `Seal` ile aynı çizim, 32 birimlik kutudan ölçeklenir). */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const k = size / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(16, 16, 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2.4
  ctx.lineCap = 'square'
  ctx.beginPath()
  ctx.moveTo(10, 22)
  ctx.lineTo(15, 10)
  ctx.moveTo(15.5, 23)
  ctx.lineTo(20.5, 11)
  ctx.moveTo(21, 22)
  ctx.lineTo(24, 15)
  ctx.stroke()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Harf aralıklı küçük etiket (arayüzdeki `.eyebrow`). */
function eyebrow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 26): void {
  ctx.font = `700 ${size}px ${BODY}`
  ctx.fillStyle = color
  ctx.letterSpacing = `${size * 0.14}px`
  ctx.fillText(text.toLocaleUpperCase('tr'), x, y)
  ctx.letterSpacing = '0px'
}

/** Kartı yeni bir canvas'a çizer. */
export async function drawSummaryCard(data: CardData): Promise<HTMLCanvasElement> {
  await loadFonts()
  const p = readPalette()
  const H = cardHeight(data)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas yok')
  ctx.textBaseline = 'alphabetic'
  const measure = (t: string) => ctx.measureText(t).width

  // Zemin ve üstte bakır şerit.
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = p.accent
  ctx.fillRect(0, 0, W, 12)

  // Üst satır: tarih.
  ctx.textAlign = 'left'
  eyebrow(ctx, 'Antrenman tamamlandı', PAD, 130, p.accent)
  ctx.font = `500 32px ${BODY}`
  ctx.fillStyle = p.muted
  ctx.fillText(fitText(data.date, INNER, measure), PAD, 182)

  // Başlık: rutin adı, büyük ve büyük harf.
  ctx.font = `800 120px ${DISPLAY}`
  ctx.fillStyle = p.text
  ctx.fillText(fitText(data.title.toLocaleUpperCase('tr'), INNER, measure), PAD, 320)
  ctx.font = `700 46px ${DISPLAY}`
  ctx.fillStyle = p.accent
  ctx.fillText('BUGÜN GÜÇLENDİN.', PAD, 380)

  // İstatistik kutuları.
  const stats: [string, string][] = [['Süre', data.duration]]
  if (data.volume) stats.push(['Toplam hacim', data.volume])
  stats.push(['Set', String(data.sets)])
  const gap = 24
  const tileW = (INNER - gap * (stats.length - 1)) / stats.length
  const tileY = TILE_Y
  stats.forEach(([label, value], i) => {
    const x = PAD + i * (tileW + gap)
    roundRect(ctx, x, tileY, tileW, TILE_H, 24)
    ctx.fillStyle = p.card
    ctx.fill()
    eyebrow(ctx, label, x + 32, tileY + 58, p.muted, 22)
    // Uzun değer ("1 sa 14 dk") kırpılmak yerine küçülür; en küçük boyutta da sığmazsa kırpılır.
    let size = 72
    ctx.font = `800 ${size}px ${DISPLAY}`
    while (measure(value) > tileW - 64 && size > 44) {
      size -= 4
      ctx.font = `800 ${size}px ${DISPLAY}`
    }
    ctx.fillStyle = p.text
    ctx.fillText(fitText(value, tileW - 64, measure), x + 32, tileY + 138)
  })

  // Hareket listesi.
  let y = LIST_TOP
  eyebrow(ctx, 'Hareketler', PAD, y - 24, p.accent)
  const rows = [...data.exercises]
  if (rows.length === 0) rows.push({ name: 'Set yapılmadı', detail: '' })
  for (const row of rows) {
    y += ROW_H
    ctx.font = `500 30px ${BODY}`
    const detailW = row.detail ? measure(row.detail) : 0
    ctx.textAlign = 'right'
    ctx.fillStyle = p.muted
    ctx.fillText(row.detail, W - PAD, y)
    ctx.textAlign = 'left'
    ctx.font = `600 36px ${BODY}`
    ctx.fillStyle = p.text
    ctx.fillText(fitText(row.name, INNER - detailW - 32, measure), PAD, y)
    ctx.fillStyle = p.line
    ctx.fillRect(PAD, y + 26, INNER, 2)
  }
  if (data.moreExercises > 0) {
    y += ROW_H
    ctx.font = `500 30px ${BODY}`
    ctx.fillStyle = p.muted
    ctx.fillText(`+${data.moreExercises} hareket daha`, PAD, y)
  }

  // Yeni rekorlar.
  const prRows = data.prs.map((pr) => pr.name.toLocaleUpperCase(pr.lang ?? 'tr'))
  if (data.morePrs > 0) prRows.push(`+${data.morePrs} REKOR DAHA`)
  if (prRows.length > 0) {
    const boxY = y + 70
    const boxH = 90 + prRows.length * PR_ROW_H
    roundRect(ctx, PAD, boxY, INNER, boxH, 24)
    ctx.fillStyle = p.accentSoft
    ctx.fill()
    ctx.strokeStyle = p.accent
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 1
    eyebrow(ctx, 'Yeni rekorlar', PAD + 36, boxY + 64, p.accent)
    ctx.font = `700 44px ${DISPLAY}`
    ctx.fillStyle = p.text
    prRows.forEach((name, i) => {
      ctx.fillText(fitText(name, INNER - 72, measure), PAD + 36, boxY + 64 + PR_ROW_H * (i + 1))
    })
  }

  // Alt bilgi: mühür ve uygulama adı.
  const footY = H - 90
  drawSeal(ctx, PAD, footY - 44, 56, p.accent)
  ctx.font = `800 52px ${DISPLAY}`
  ctx.fillStyle = p.text
  ctx.letterSpacing = '2px'
  ctx.fillText('MONK', PAD + 76, footY)
  const monkW = measure('MONK')
  ctx.fillStyle = p.accent
  ctx.fillText('MODE', PAD + 76 + monkW, footY)
  ctx.letterSpacing = '0px'
  return canvas
}

/** Canvas'ı PNG dosyasına çevirir. */
function toPng(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: 'image/png' })) : reject(new Error('PNG üretilemedi'))), 'image/png')
  })
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Kartı çizer; tarayıcı dosya paylaşabiliyorsa paylaşım menüsünü açar, yoksa (ya da `canShare` false
 * dönerse) PNG'yi indirir. Kullanıcı dokunuşuyla çağrılmalı (paylaşım menüsü jest ister).
 */
export async function shareSummaryCard(workout: Workout, opts: CardOptions): Promise<ShareResult> {
  const file = await toPng(await drawSummaryCard(buildCardData(workout, opts)), cardFileName(workout))
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: workout.name })
      return 'shared'
    } catch (e) {
      // Kullanıcı vazgeçti; başka bir hata (ör. jest süresi doldu) olursa indirmeye düşülür.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  // İndirme başlasın diye adres hemen bırakılmaz.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
