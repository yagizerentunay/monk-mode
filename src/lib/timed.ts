import { formatClock } from './alert.ts'

/**
 * Süreli setler (plank, yan plank, izometrik, asılı kalma…). Tasarım kararı: süre için ayrı alan açmak
 * yerine `SetEntry.r` / `SideSet.r` süreli girdide SANİYE olarak okunur ve girdi `WorkoutEntry.timed` ile
 * işaretlenir (rutinde aynı şekilde `ExCfg.reps` / `repsMax` saniyedir). Böylece tek taraflı setler,
 * yarım set, hedef aralığı, düzenleme ve yedek akışı tekrar için yazılmış mantığın aynısını kullanır.
 * Bedeli: `r`yi kg × tekrar ya da 1RM olarak okuyan her yer girdinin `timed` bayrağına bakmalıdır
 * (workoutVolume, exerciseHistory, isPR, exerciseSummary, deload, plato, ilerleme). Bayrağı olmayan
 * eski kayıtlar değişmez.
 */

/** Bir sette tutulabilecek en uzun süre (sn); yükleyici ve arayüz bunu aşmaz. */
export const MAX_TIMED_SEC = 3600

/** Süreli egzersiz açılınca varsayılan hedef (sn). */
export const DEFAULT_TIMED_SEC = 30

/** Tüm hedef setler tamamlanınca bir sonraki seansın hedefine eklenen süre (sn). */
export const TIMED_STEP_SEC = 5

/** Saniyeyi 0-3600 tam sayıya çeker; sonlu olmayan değer 0 olur. */
export function clampSec(v: number): number {
  return Number.isFinite(v) ? Math.min(MAX_TIMED_SEC, Math.max(0, Math.round(v))) : 0
}

/** "45 sn" (bir dakikanın altı) ya da "1:30" (bir dakika ve üstü). */
export function formatDuration(sec: number): string {
  const s = clampSec(sec)
  return s < 60 ? `${s} sn` : formatClock(s)
}

/** Alanlarda gösterilen süre: her zaman "d:ss" ("0:45", "1:30"). */
export function formatClockField(sec: number): string {
  return formatClock(clampSec(sec))
}

/**
 * Yazılan süreyi saniyeye çevirir: "90", "1:30", "1.5" (virgül de olur; ondalık saniye yuvarlanır).
 * Çözülemeyen ya da negatif girdi null; sonuç 0-3600'e çekilir.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const clock = /^(\d+):([0-5]?\d)$/.exec(t)
  if (clock) return clampSec(Number(clock[1]) * 60 + Number(clock[2]))
  if (!/^\d+(?:\.\d+)?$/.test(t)) return null
  return clampSec(Number(t))
}

/**
 * Kronometrenin geçen saniyesi: başlangıç damgasından hesaplanır (aralık sayacı değil), bu yüzden
 * yeniden çizim, sekme arka plana gitmesi ya da ekran kilidi sayacı kaydırmaz. Saat geri giderse 0.
 */
export function elapsedSec(startedAt: number, now: number): number {
  return clampSec(Math.floor((now - startedAt) / 1000))
}
