import { t } from '../i18n/index.ts'
import type { StrengthGoal, Workout } from '../store/schema.ts'
import { formatShortDay, parseDay } from './calendar.ts'
import { formatWeight, type Unit } from './units.ts'
import { dayString, exerciseHistory } from './workout.ts'

/**
 * Kuvvet hedefi tahmini. Egzersizin seans başına en iyi tahmini 1RM'ine (grafikteki değer, bkz.
 * `exerciseHistory`) son 8 haftada doğrusal eğim uydurulur ve hedefe kalan fark bu hızla bölünür.
 *
 * - Süreli seanslar 1RM'siz ölçülür; hiç sayılmaz.
 * - Deload: eğim ham değerlere değil, pencere içindeki "o güne kadarki en iyi" değere uydurulur. Hafif
 *   bir hafta en iyiyi düşürmez, eğimi de bozmaz; gerçek bir duraklama ise düz eğim olarak görünür.
 * - Veri yetersizse (az seans, kısa aralık, düz ya da düşen eğim) tarih uydurulmaz.
 */

/** Eğimin uydurulduğu pencere (gün): son 8 hafta, bugün dahil. */
export const WINDOW_DAYS = 56
/** Tahmin için pencerede gereken en az seans. */
export const MIN_SESSIONS = 4
/** Pencere içindeki ilk ve son seans arasında gereken en az gün (tek haftalık sıçrama trend sayılmaz). */
export const MIN_SPAN_DAYS = 14
/** Haftalık artış bundan azsa (kg) eğim düz sayılır: o hızla tarih anlamsız uzaklıkta olur. */
export const MIN_WEEKLY_GAIN = 0.1
/** Tahmini varış hedef günden en çok bu kadar gün saparsa "zamanında" sayılır. */
export const ON_TIME_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/** `from`dan `to`ya kaç takvim günü (yaz saati kayması günü bozmaz). */
export function dayDiff(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS)
}

export function addDays(d: string, n: number): string {
  const t = parseDay(d)
  return dayString(new Date(t.getFullYear(), t.getMonth(), t.getDate() + n))
}

export interface GoalPoint {
  d: string
  /** Seansın en iyi tahmini 1RM'i (kg). */
  e1rm: number
}

/** Egzersizin tekrarlı seansları ve en iyi tahmini 1RM'leri, eski→yeni. */
export function goalHistory(workouts: Workout[], exId: string): GoalPoint[] {
  return exerciseHistory(workouts, exId)
    .filter((p) => !p.timed && !p.distance && p.e1rm > 0)
    .map((p) => ({ d: p.d, e1rm: p.e1rm }))
}

/** Hedefin oluşturulduğu günden itibaren hedefe ilk ulaşılan seansın günü; ulaşılmadıysa undefined. */
export function reachedOn(goal: StrengthGoal, points: GoalPoint[]): string | undefined {
  // Kayan nokta payı: 100 kg hedef, 75 × 10 gibi tam 100 veren sette tutsun.
  return points.find((p) => p.d >= goal.created && p.e1rm >= goal.target - 1e-9)?.d
}

export type GoalStatus = 'ahead' | 'onTime' | 'behind'

export type GoalForecast =
  /** Hedefe ulaşıldı (`d` günü). */
  | { kind: 'reached'; d: string; current?: number }
  /** Pencerede yeterli seans yok ya da seanslar çok kısa bir aralıkta; `current` pencere içindeki en iyi. */
  | { kind: 'noData'; sessions: number; current?: number }
  /** Eğim düz ya da düşüyor: bu gidişle tarih verilemez. */
  | { kind: 'flat'; current: number }
  /** Bu hızla tahmini varış günü ve hedef güne göre durumu. `perWeek` kg/hafta. */
  | { kind: 'eta'; eta: string; status: GoalStatus; perWeek: number; current: number }

/** En küçük kareler eğimi (y birimi / x birimi). */
export function slope(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den === 0 ? 0 : num / den
}

/** `today`: YYYY-MM-DD, yerel gün. `workouts` eski→yeni sıralıdır. */
export function forecastGoal(goal: StrengthGoal, workouts: Workout[], today: string): GoalForecast {
  const points = goalHistory(workouts, goal.exId)
  const inWindow = points.filter((p) => {
    const ago = dayDiff(p.d, today)
    return ago >= 0 && ago <= WINDOW_DAYS
  })
  // Pencere içinde o güne kadarki en iyi değer (deload haftası düşürmez).
  const best: number[] = []
  for (const p of inWindow) best.push(Math.max(p.e1rm, best[best.length - 1] ?? 0))
  const current = best.length > 0 ? best[best.length - 1] : undefined

  const done = goal.done ?? reachedOn(goal, points)
  if (done) return { kind: 'reached', d: done, current }

  const span = inWindow.length > 0 ? dayDiff(inWindow[0].d, inWindow[inWindow.length - 1].d) : 0
  if (current === undefined || inWindow.length < MIN_SESSIONS || span < MIN_SPAN_DAYS) {
    return { kind: 'noData', sessions: inWindow.length, current }
  }

  const perDay = slope(
    inWindow.map((p) => -dayDiff(p.d, today)),
    best,
  )
  if (perDay * 7 < MIN_WEEKLY_GAIN) return { kind: 'flat', current }

  const eta = addDays(today, Math.max(0, Math.ceil((goal.target - current) / perDay)))
  const late = dayDiff(goal.by, eta)
  const status: GoalStatus = late < -ON_TIME_DAYS ? 'ahead' : late > ON_TIME_DAYS ? 'behind' : 'onTime'
  return { kind: 'eta', eta, status, perWeek: perDay * 7, current }
}

/** Henüz işaretlenmemiş ama artık ulaşılmış hedefler ve ulaşma günleri. */
export function newlyReached(goals: StrengthGoal[], workouts: Workout[]): { id: string; d: string }[] {
  const out: { id: string; d: string }[] = []
  for (const g of goals) {
    if (g.done) continue
    const d = reachedOn(g, goalHistory(workouts, g.exId))
    if (d) out.push({ id: g.id, d })
  }
  return out
}

/** "3 hafta", "5 gün": hedef güne göre fark için kısa metin. */
function span(days: number): string {
  const n = Math.abs(days)
  return n >= 14 ? t('count.weeks', { n: Math.round(n / 7) }) : t('count.days', { n })
}

/** Tahmini kartta gösterilecek tek satır. Tarih uydurulmaz: veri yoksa nedenini söyler. */
export function describeForecast(f: GoalForecast, goal: StrengthGoal, unit: Unit, now: Date = new Date()): string {
  switch (f.kind) {
    case 'reached':
      return t('goals.reachedOn', { date: formatShortDay(f.d, now) })
    case 'noData':
      return f.sessions === 0
        ? t('goals.noSessions')
        : t('goals.notEnough', { sessions: t('count.sessions', { n: f.sessions }), min: MIN_SESSIONS })
    case 'flat':
      return t('goals.flat')
    case 'eta': {
      const late = dayDiff(goal.by, f.eta)
      const rel =
        f.status === 'onTime'
          ? t('goals.onTime')
          : f.status === 'ahead'
            ? t('goals.ahead', { span: span(late) })
            : t('goals.behind', { span: span(late) })
      return t('goals.eta', { date: formatShortDay(f.eta, now), rel, rate: `+${formatWeight(f.perWeek, unit)} ${unit}` })
    }
  }
}

/** Egzersizin grafikte gösterilecek hedefi: en son eklenen açık hedef, yoksa en son ulaşılan. */
export function goalFor(goals: StrengthGoal[], exId: string): StrengthGoal | undefined {
  const mine = goals.filter((g) => g.exId === exId)
  return mine.findLast((g) => !g.done) ?? mine[mine.length - 1]
}
