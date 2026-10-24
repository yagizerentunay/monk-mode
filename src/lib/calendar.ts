import { labels, locale, t, type MessageKey } from '../i18n/index.ts'
import { DAY_NAMES } from './dates.ts'
import { dayString } from './workout.ts'

/** Ay adları (0 = Ocak), geçerli arayüz dilinde. */
export const MONTH_NAMES = labels(
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, `month.${i}` as MessageKey])),
) as Readonly<Record<number, string>>

export interface CalendarCell {
  /** YYYY-MM-DD, yerel gün. */
  date: string
  /** Ayın günü (1-31). */
  day: number
  /** Görüntülenen aya ait mi (önceki/sonraki ayın taşan günleri false). */
  inMonth: boolean
  /** 0 = Pazar … 6 = Cumartesi, Date.getDay() ile uyumlu. */
  dow: number
}

/** 'YYYY-MM-DD' → yerel günün başlangıcı. UTC'den geçmez, yaz saati kayması günü bozmaz. */
export function parseDay(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

/**
 * Ayın takvim ızgarası: hafta `weekStart` gününde başlar (0 Pazar, 1 Pazartesi, 6 Cumartesi), ilk ve
 * son hafta komşu ayların günleriyle tamamlanır. Satır sayısı 4 ile 6 arasındadır.
 */
export function monthGrid(year: number, month: number, weekStart: number): CalendarCell[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((lead + daysInMonth) / 7)
  const rows: CalendarCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(year, month, 1 - lead + w * 7 + i)
      row.push({
        date: dayString(d),
        day: d.getDate(),
        inMonth: d.getMonth() === month && d.getFullYear() === year,
        dow: d.getDay(),
      })
    }
    rows.push(row)
  }
  return rows
}

/** Ay kaydırma: ay numarası taşınca yıl da değişir. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Başlık satırı için haftanın günleri (0-6), hafta başlangıcından başlayarak. */
export function weekdayOrder(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7)
}

function dayMonth(date: Date, month: string, today: Date): string {
  const params = { day: date.getDate(), month, year: date.getFullYear() }
  return date.getFullYear() === today.getFullYear() ? t('date.short', params) : t('date.shortYear', params)
}

/** "6 Ekim" / "October 6"; yıl `today`ın yılından farklıysa "6 Ekim 2025". Varsayılan `today` render dışında değerlendirilir. */
export function formatShortDay(d: string, today: Date = new Date()): string {
  const date = parseDay(d)
  return dayMonth(date, MONTH_NAMES[date.getMonth()], today)
}

/** Grafik ekseni için dar biçim: "6 Eki" / "Oct 6"; yıl `today`ın yılından farklıysa "30 Ara 2025". */
export function formatAxisDay(d: string, today: Date = new Date()): string {
  const date = parseDay(d)
  return dayMonth(date, MONTH_NAMES[date.getMonth()].slice(0, 3), today)
}

/** Zaman damgası, tarih ve saatle: "24 Eki 2026 11:30" / "Oct 24, 2026, 11:30 AM". */
export function formatDateTime(at: number): string {
  return new Date(at).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
}

/** "Salı, 6 Ekim 2026" / "Tuesday, October 6, 2026" */
export function formatDayTitle(d: string): string {
  const date = parseDay(d)
  return t('date.title', {
    weekday: DAY_NAMES[date.getDay()],
    day: date.getDate(),
    month: MONTH_NAMES[date.getMonth()],
    year: date.getFullYear(),
  })
}
