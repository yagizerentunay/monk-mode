import type { SetEntry } from '../store/schema.ts'
import { formatDecimal } from './units.ts'

/**
 * Mesafe setleri (koşu, bisiklet, kürek, yürüyüş: mesafe + süre). Tasarım kararı süreli setlerle (lib/timed.ts)
 * aynı çizgidedir: girdi `WorkoutEntry.distance` ile işaretlenir, `SetEntry.r` SANİYE (setin süresi) olarak
 * okunur ve mesafe yeni isteğe bağlı `SetEntry.m` alanında METRE olarak tutulur. Rutinde `ExCfg.reps` hedef
 * süre (sn), `ExCfg.meters` hedef mesafedir (m). Ağırlık (`w`) kullanılmaz ve 0 kalır; tek taraflı, ısınma,
 * dropset ve RIR mesafe setinde yoktur.
 * Bedeli: `r`yi kg × tekrar ya da 1RM olarak okuyan her yer girdinin `distance` bayrağına bakmalıdır
 * (workoutVolume, exerciseHistory, isPR, exerciseSummary, records, deload, plato, ilerleme). Bayrağı olmayan
 * eski kayıtlar değişmez; `m` alanı bilmeyen eski sürümlerde yedekten okunurken atılır.
 */

/** Bir sette tutulabilecek en uzun mesafe (m, 1000 km); yükleyici ve arayüz bunu aşmaz. */
export const MAX_DISTANCE_M = 1_000_000

/** Bir mesafe setinin en uzun süresi (sn, 24 saat). */
export const MAX_DISTANCE_SEC = 86_400

/** Mesafe egzersizi açılınca varsayılan hedef: 5 km, 30 dk, tek set. */
export const DEFAULT_DISTANCE_M = 5000
export const DEFAULT_DISTANCE_SEC = 1800
export const DEFAULT_DISTANCE_SETS = 1

/**
 * En iyi tempo rekoru için setin en kısa mesafesi (m). Daha kısa bir "set" (örn. 100 m depar) tempoyu
 * gerçek bir koşudan hızlı gösterip rekoru anlamsızlaştırırdı.
 */
export const PACE_MIN_M = 500

/** Metreyi 0-1.000.000 tam sayıya çeker; sonlu olmayan değer 0 olur. */
export function clampMeters(v: number): number {
  return Number.isFinite(v) ? Math.min(MAX_DISTANCE_M, Math.max(0, Math.round(v))) : 0
}

/** Mesafe setinin süresini 0-86.400 sn tam sayıya çeker; sonlu olmayan değer 0 olur. */
export function clampDistanceSec(v: number): number {
  return Number.isFinite(v) ? Math.min(MAX_DISTANCE_SEC, Math.max(0, Math.round(v))) : 0
}

/** Setin mesafesi (m); alan yoksa 0. */
export function setMeters(set: Pick<SetEntry, 'm'>): number {
  return set.m ?? 0
}

/** "800 m" (1 km altı) ya da "5,25 km" (en fazla iki ondalık, sondaki sıfırlar atılır). */
export function formatDistance(m: number): string {
  const v = clampMeters(m)
  if (v < 1000) return `${v} m`
  return `${formatDecimal(Math.round(v / 10) / 100)} km`
}

/** Kilometre alanında gösterilen değer (m → km). */
export const metersToKm = (m: number): number => m / 1000
/** Kilometre alanına yazılan değer (km → m, metreye yuvarlanır). */
export const kmToMeters = (km: number): number => clampMeters(km * 1000)

/** Süre: "45:00" ya da bir saat ve üstünde "1:05:30". */
export function formatLongClock(sec: number): string {
  const s = clampDistanceSec(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/**
 * Yazılan kardiyo süresini saniyeye çevirir. Düz sayı DAKİKADIR ("30" = 30:00, "12,5" = 12:30); "d:ss"
 * ("45:30") ve "s:dd:ss" ("1:05:30") da olur. Çözülemeyen girdi null; sonuç 0-86.400'e çekilir.
 */
export function parseLongDuration(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const hms = /^(\d+):([0-5]?\d):([0-5]?\d)$/.exec(t)
  if (hms) return clampDistanceSec(Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]))
  const ms = /^(\d+):([0-5]?\d)$/.exec(t)
  if (ms) return clampDistanceSec(Number(ms[1]) * 60 + Number(ms[2]))
  if (!/^\d+(?:\.\d+)?$/.test(t)) return null
  return clampDistanceSec(Number(t) * 60)
}

/** Tempo, saniye/km; mesafe ya da süre yoksa undefined. */
export function paceSecPerKm(m: number, sec: number): number | undefined {
  return m > 0 && sec > 0 ? (sec * 1000) / m : undefined
}

/** "5:30 /km"; tempo hesaplanamazsa boş metin. */
export function formatPace(m: number, sec: number): string {
  const p = paceSecPerKm(m, sec)
  return p === undefined ? '' : `${formatLongClock(p)} /km`
}

/** Mesafe setinin kısa özeti: "5 km · 27:30 · 5:30 /km"; bilinmeyen parça yazılmaz. */
export function formatDistanceSet(set: Pick<SetEntry, 'm' | 'r'>): string {
  const m = setMeters(set)
  return [m > 0 ? formatDistance(m) : '', set.r > 0 ? formatLongClock(set.r) : '', formatPace(m, set.r)]
    .filter(Boolean)
    .join(' · ')
}

/** Çalışma setlerinin toplam mesafesi (m) ve toplam süresi (sn). */
export function distanceTotals(sets: readonly Pick<SetEntry, 'm' | 'r'>[]): { m: number; sec: number } {
  return sets.reduce((t, s) => ({ m: t.m + setMeters(s), sec: t.sec + s.r }), { m: 0, sec: 0 })
}

/** En iyi tempoya sayılabilir mi: en az PACE_MIN_M ve süresi girilmiş. */
export function countsForPace(set: Pick<SetEntry, 'm' | 'r'>): boolean {
  return setMeters(set) >= PACE_MIN_M && set.r > 0
}
