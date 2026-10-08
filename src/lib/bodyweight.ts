import type { BodyweightEntry } from '../store/schema.ts'
import { kgToUnit, type Unit } from './units.ts'

/** Hedef hıza bu kadar (kg/hafta) yakın olan hız "hedefte" sayılır; günlük tartı dalgalanması büyüktür. */
export const GOAL_TOLERANCE_KG = 0.15
/** Haftalık değişim hızı için bakılan pencere ve en az güvenilir veri. */
export const RATE_WINDOW_DAYS = 28
const MIN_RATE_POINTS = 3
const MIN_RATE_SPAN_DAYS = 10

const DAY_MS = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' → gün numarası. UTC'den hesaplanır, yaz saati kayması günü bozmaz. */
export function dayIndex(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, day) / DAY_MS)
}

/** `endDay` dahil geriye `days` günlük pencerede tartıların ortalaması; kayıt yoksa null. */
export function averageOver(entries: readonly BodyweightEntry[], endDay: number, days: number): number | null {
  const inWindow = entries.filter((e) => {
    const di = dayIndex(e.d)
    return di <= endDay && di > endDay - days
  })
  if (inWindow.length === 0) return null
  return inWindow.reduce((s, e) => s + e.w, 0) / inWindow.length
}

/**
 * Son `windowDays` günün doğrusal eğiminden haftalık değişim (kg/hafta). Tek tek tartı gün içinde
 * ±1 kg oynadığı için iki uç nokta yerine tüm noktalara en küçük kareler doğrusu uydurulur. Veri
 * azsa (en az 3 tartı ve 10 günlük aralık) güvenilir bir hız çıkmaz: null.
 */
export function weeklyRate(
  entries: readonly BodyweightEntry[],
  endDay: number,
  windowDays: number = RATE_WINDOW_DAYS,
): number | null {
  const pts = entries
    .map((e) => ({ x: dayIndex(e.d), y: e.w }))
    .filter((p) => p.x <= endDay && p.x > endDay - windowDays)
  if (pts.length < MIN_RATE_POINTS) return null
  const xs = pts.map((p) => p.x)
  if (Math.max(...xs) - Math.min(...xs) < MIN_RATE_SPAN_DAYS) return null
  const n = pts.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  return den === 0 ? null : (num / den) * 7
}

export type GoalStatus = 'on' | 'below' | 'above'

/** Gerçek hız hedefin tolerans içinde mi, altında mı (daha yavaş/az), üstünde mi (daha hızlı/çok). */
export function goalStatus(rate: number, goal: number, tolerance: number = GOAL_TOLERANCE_KG): GoalStatus {
  const diff = rate - goal
  if (Math.abs(diff) <= tolerance + 1e-9) return 'on'
  return diff < 0 ? 'below' : 'above'
}

/** "+0,25 kg/hf" gibi: işaretli, en fazla iki ondalık, ondalık ayracı virgül. */
export function formatRate(kgPerWeek: number, unit: Unit): string {
  const v = Math.round(kgToUnit(kgPerWeek, unit) * 100) / 100
  const text = String(Math.abs(v)).replace('.', ',')
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${text} ${unit}/hf`
}
