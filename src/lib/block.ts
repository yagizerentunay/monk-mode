import type { PastBlock, TrainingBlock, Workout } from '../store/schema.ts'
import { weekStartOf } from './streak.ts'
import { dayString } from './workout.ts'

/**
 * Antrenman bloğu (mezosiklus) hesapları. Blok 4–6 takvim haftasıdır; haftalar Ayarlar'daki hafta
 * başlangıcına (`weekStart`) göre sayılır ve 1. hafta, başlangıç gününün haftasıdır. Böylece Ana Sayfa'daki
 * hafta şeridi, "bu hafta" ve blok haftası aynı günlerde değişir. Blok hiçbir şeyi otomatik değiştirmez:
 * deload haftasında yalnız öneri gösterilir (bkz. lib/deload.ts).
 */

export const MIN_BLOCK_WEEKS = 4
export const MAX_BLOCK_WEEKS = 6
export const DEFAULT_BLOCK_WEEKS = 5

/** Geçmişte tutulan en çok blok sayısı; en eskisi düşer. */
export const MAX_PAST_BLOCKS = 12

/** Hafta sayısını izinli aralığa çeker; sayı değilse varsayılan. */
export function clampWeeks(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_BLOCK_WEEKS
  return Math.min(MAX_BLOCK_WEEKS, Math.max(MIN_BLOCK_WEEKS, Math.round(v)))
}

/** YYYY-MM-DD → yerel gün başlangıcı. */
export function parseDay(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

/** Takvim günü numarası. UTC üzerinden: yaz saati geçişindeki 23/25 saatlik gün hafta hesabını kaydırmaz. */
function dayNo(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/** Bloğun 1. haftasının ilk günü (gün numarası). */
function origin(block: TrainingBlock, weekStart: number): number {
  return dayNo(weekStartOf(parseDay(block.start), weekStart))
}

/** `date`'in blok haftası (1'den başlar). 1'den küçükse blok henüz başlamadı, `weeks`ten büyükse süresi doldu. */
export function blockWeekOf(block: TrainingBlock, date: Date, weekStart: number): number {
  return Math.floor((dayNo(date) - origin(block, weekStart)) / 7) + 1
}

export type BlockPhase = 'upcoming' | 'running' | 'over'

export interface BlockStatus {
  phase: BlockPhase
  /** Bugünün blok haftası; yalnız `running` iken 1..weeks arasındadır. */
  week: number
  weeks: number
  /** Bu hafta planlı deload haftası mı. */
  deload: boolean
}

export function blockStatus(block: TrainingBlock, today: Date, weekStart: number): BlockStatus {
  const week = blockWeekOf(block, today, weekStart)
  const phase: BlockPhase = week < 1 ? 'upcoming' : week > block.weeks ? 'over' : 'running'
  return { phase, week, weeks: block.weeks, deload: phase === 'running' && week === block.deload }
}

/** Blok haftasının ilk ve son günü (YYYY-MM-DD). */
export function blockWeekRange(block: TrainingBlock, week: number, weekStart: number): { first: string; last: string } {
  const s = weekStartOf(parseDay(block.start), weekStart)
  const at = (offset: number) => dayString(new Date(s.getFullYear(), s.getMonth(), s.getDate() + offset))
  return { first: at((week - 1) * 7), last: at((week - 1) * 7 + 6) }
}

/** `d` günü bloğun planlı deload haftasında mı? Biten blokta bitiş gününden sonrası sayılmaz. */
export function inDeloadWeek(block: TrainingBlock | PastBlock, d: string, weekStart: number): boolean {
  if ('end' in block && d > block.end) return false
  const { first, last } = blockWeekRange(block, block.deload, weekStart)
  return d >= first && d <= last
}

/**
 * Planlı deload haftalarına düşen antrenmanları çıkarır. O haftanın seansları bilerek hafiftir; otomatik
 * deload önerisi (`detectDeload`) onları düşüş saymasın, deload bitince hemen yeni bir öneri çıkmasın.
 */
export function withoutDeloadWeeks(
  workouts: Workout[],
  blocks: ReadonlyArray<TrainingBlock | PastBlock>,
  weekStart: number,
): Workout[] {
  if (blocks.length === 0) return workouts
  return workouts.filter((w) => !blocks.some((b) => inDeloadWeek(b, w.d, weekStart)))
}

/** Yeni blok; deload varsayılan olarak son haftadır. */
export function newBlock(id: string, start: string, weeks: number = DEFAULT_BLOCK_WEEKS, deload?: number): TrainingBlock {
  const w = clampWeeks(weeks)
  return { id, start, weeks: w, deload: Math.min(w, Math.max(1, deload ?? w)) }
}

/**
 * Blok düzenleme. Deload son haftadaysa hafta sayısı değişince de son haftada kalır (varsayılanı izler);
 * başka bir haftadaysa yerinde kalır, yeni hafta sayısını aşarsa son haftaya çekilir.
 */
export function editBlock(block: TrainingBlock, patch: Partial<Pick<TrainingBlock, 'start' | 'weeks' | 'deload'>>): TrainingBlock {
  const weeks = patch.weeks === undefined ? block.weeks : clampWeeks(patch.weeks)
  const followLast = patch.deload === undefined && block.deload === block.weeks
  const want = patch.deload ?? (followLast ? weeks : block.deload)
  return { ...block, start: patch.start ?? block.start, weeks, deload: Math.min(weeks, Math.max(1, Math.round(want))) }
}

/** Bloğu geçmişe taşınacak hâle getirir. */
export function closeBlock(block: TrainingBlock, end: string, outcome: PastBlock['outcome']): PastBlock {
  return { ...block, end, outcome }
}

/** Geçmişe ekler: bitişe göre sıralı, en çok MAX_PAST_BLOCKS. Aynı kimlik varsa yenisi yerine geçer. */
export function addPastBlock(past: readonly PastBlock[], block: PastBlock): PastBlock[] {
  return [...past.filter((p) => p.id !== block.id), block]
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(-MAX_PAST_BLOCKS)
}

/** Süresi dolmuş bloğun doğal bitiş günü: son haftanın son günü. */
export function blockLastDay(block: TrainingBlock, weekStart: number): string {
  return blockWeekRange(block, block.weeks, weekStart).last
}

/**
 * "Deload'u bu haftaya planla". Süren blokta deload bu haftaya taşınır. Blok yoksa ya da süresi dolduysa
 * (dolan blok "bitti" olarak geçmişe geçer) bu hafta başlayan, ilk haftası deload olan yeni bir blok
 * kurulur: önce toparlan, sonra kalan haftalarda yeniden yüklen. Henüz başlamamış blok varsa planı bozmamak
 * için undefined (eylem gösterilmez).
 */
export function planDeloadThisWeek(
  block: TrainingBlock | null,
  today: Date,
  weekStart: number,
  id: string,
): { block: TrainingBlock; closed?: PastBlock } | undefined {
  if (block) {
    const st = blockStatus(block, today, weekStart)
    if (st.phase === 'upcoming') return undefined
    if (st.phase === 'running') return { block: { ...block, deload: st.week } }
    return {
      block: newBlock(id, dayString(today), DEFAULT_BLOCK_WEEKS, 1),
      closed: closeBlock(block, blockLastDay(block, weekStart), 'done'),
    }
  }
  return { block: newBlock(id, dayString(today), DEFAULT_BLOCK_WEEKS, 1) }
}
