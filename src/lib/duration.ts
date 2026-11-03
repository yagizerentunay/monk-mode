import type { Workout } from '../store/schema.ts'
import { dayString } from './workout.ts'

/** Tahmin için gereken en az geçmiş seans sayısı: tek seansla "genelde" denmez. */
export const MIN_DURATION_SESSIONS = 2

/** Medyana giren en yeni seans sayısı. */
const RECENT_SESSIONS = 5

/** Bu aralığın dışındaki süreler (yarım bırakılıp sonradan bitirilen ya da yanlış kaydedilen seans) sayılmaz. */
const MIN_MIN = 10
const MAX_MIN = 240

/** Dakikayı 5'e yuvarlar: tahmin kesinmiş gibi görünmesin. */
const STEP_MIN = 5

/**
 * Rutinin genelde ne kadar sürdüğü (dk, 5'e yuvarlı): aynı rutinin son 5 seansının süre medyanı. Süre
 * `end - start`tir; geçmiş güne girilen (başlangıcı kayıt gününe uymayan), bitişi olmayan ve 10 dk–4 saat
 * dışındaki seanslar sayılmaz. En az MIN_DURATION_SESSIONS seans yoksa undefined: uydurma tahmin verilmez.
 * `workouts` eski→yeni sıralıdır.
 */
export function typicalDurationMin(workouts: Workout[], routineId: string): number | undefined {
  const mins: number[] = []
  for (let i = workouts.length - 1; i >= 0 && mins.length < RECENT_SESSIONS; i--) {
    const w = workouts[i]
    if (w.routineId !== routineId || w.end === undefined) continue
    if (dayString(new Date(w.start)) !== w.d) continue
    const min = (w.end - w.start) / 60000
    if (min >= MIN_MIN && min <= MAX_MIN) mins.push(min)
  }
  if (mins.length < MIN_DURATION_SESSIONS) return undefined
  mins.sort((a, b) => a - b)
  const mid = mins.length >> 1
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2
  return Math.max(STEP_MIN, Math.round(median / STEP_MIN) * STEP_MIN)
}
