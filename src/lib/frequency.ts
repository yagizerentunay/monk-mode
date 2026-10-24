import { t } from '../i18n/index.ts'
import type { Workout } from '../store/schema.ts'
import { formatDayTitle, MONTH_NAMES, parseDay } from './calendar.ts'
import { weekRanges } from './muscles.ts'
import { dayString, doneSetCount } from './workout.ts'

/** Isı haritasının kaç hafta geriye baktığı (içinde bulunulan hafta dahil). */
export const HEATMAP_WEEKS = 16

/** Yoğunluk kademeleri: 0 = set yok, 1 = 1-9, 2 = 10-19, 3 = 20+. */
export type HeatLevel = 0 | 1 | 2 | 3

/** Kademe alt sınırları (set); gösterge ve etiketler de bunu kullanır. */
export const HEAT_LEGEND: { level: HeatLevel; label: string }[] = [
  { level: 0, label: '0' },
  { level: 1, label: '1-9' },
  { level: 2, label: '10-19' },
  { level: 3, label: '20+' },
]

/** Günün tamamlanan çalışma seti sayısından kademe. */
export function heatLevel(sets: number): HeatLevel {
  if (!(sets > 0)) return 0
  if (sets < 10) return 1
  return sets < 20 ? 2 : 3
}

export interface HeatDay {
  /** YYYY-MM-DD, yerel gün. */
  date: string
  /** Günün tamamlanan çalışma setleri (ısınma ve dropset hariç; bkz. doneSetCount). */
  sets: number
  workouts: number
  level: HeatLevel
  /** Bugünden sonraki gün: ızgarayı tamamlamak için vardır, veri yoktur. */
  future: boolean
  isToday: boolean
}

/** "Salı, 6 Ekim 2026: 12 set" / "…: antrenman yok" (hücrenin erişilebilir adı ve ipucu). */
export function cellLabel(day: HeatDay): string {
  return `${formatDayTitle(day.date)}: ${day.sets > 0 ? t('count.sets', { n: day.sets }) : t('freq.noWorkout')}`
}

export interface HeatmapGrid {
  /** Eskiden yeniye haftalar (sütunlar); her biri `weekStart`tan başlayan 7 gün (satırlar). */
  weeks: HeatDay[][]
  /** Ay adı yazılacak sütunlar (ayın ilk göründüğü hafta). */
  monthLabels: { col: number; label: string }[]
}

/**
 * Son `weeks` haftanın günlük set sayıları. Sütunlar haftalar, satırlar `weekStart` (0 Pazar … 6 Cumartesi,
 * geçersiz değer Pazartesi) gününden başlayan haftanın günleridir. Tarih aritmetiği yerel takvim günü
 * üzerinden yapılır (24 saat eklenmez), bu yüzden yaz/kış saati ve yıl geçişi günleri kaydırmaz.
 */
export function heatmapGrid(workouts: Workout[], today: Date, weekStart: number, weeks = HEATMAP_WEEKS): HeatmapGrid {
  const first = parseDay(weekRanges(today, weekStart).thisFrom)
  const sets = new Map<string, { sets: number; workouts: number }>()
  for (const w of workouts) {
    const cur = sets.get(w.d) ?? { sets: 0, workouts: 0 }
    cur.sets += doneSetCount(w).done
    cur.workouts += 1
    sets.set(w.d, cur)
  }
  const todayKey = dayString(today)
  const cols: HeatDay[][] = []
  for (let c = 0; c < weeks; c++) {
    const col: HeatDay[] = []
    for (let r = 0; r < 7; r++) {
      const date = dayString(new Date(first.getFullYear(), first.getMonth(), first.getDate() - (weeks - 1 - c) * 7 + r))
      const hit = sets.get(date)
      const n = hit?.sets ?? 0
      col.push({ date, sets: n, workouts: hit?.workouts ?? 0, level: heatLevel(n), future: date > todayKey, isToday: date === todayKey })
    }
    cols.push(col)
  }
  return { weeks: cols, monthLabels: monthLabels(cols) }
}

/**
 * Ay etiketleri: her sütunun ilk gününün ayına bakılır, ay değişince o sütuna ad yazılır. İlk sütun hep
 * etiketlenir ama hemen yanındaki sütun yeni ay başlatıyorsa (iki etiket çakışırdı) atlanır.
 */
export function monthLabels(weeks: HeatDay[][]): { col: number; label: string }[] {
  const out: { col: number; label: string }[] = []
  let prev = -1
  weeks.forEach((col, i) => {
    const m = parseDay(col[0].date).getMonth()
    if (m !== prev) out.push({ col: i, label: MONTH_NAMES[m].slice(0, 3) })
    prev = m
  })
  if (out.length >= 2 && out[1].col - out[0].col < 2) out.shift()
  return out
}

/** Takvim ayı özeti: bu ayın ve geçen ayın antrenman sayısı (yılbaşında geçen ay Aralık'tır). */
export function monthSummary(workouts: Workout[], today: Date): { thisMonth: number; lastMonth: number } {
  const prefix = (d: Date) => dayString(d).slice(0, 7)
  const thisKey = prefix(today)
  const lastKey = prefix(new Date(today.getFullYear(), today.getMonth() - 1, 1))
  let thisMonth = 0
  let lastMonth = 0
  for (const w of workouts) {
    const key = w.d.slice(0, 7)
    if (key === thisKey) thisMonth++
    else if (key === lastKey) lastMonth++
  }
  return { thisMonth, lastMonth }
}
