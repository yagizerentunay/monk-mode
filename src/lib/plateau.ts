import type { Workout } from '../store/schema.ts'
import { exerciseHistory } from './workout.ts'

/** Plato sayılması için tahmini 1RM rekorundan bu yana geçmesi gereken seans sayısı. */
export const PLATEAU_SESSIONS = 3

/** Son seans en iyinin bu oranının altındaysa bilinçli ara verme (deload) sayılır, plato değil. */
const NEAR_BEST = 0.95

export interface Plateau {
  /** Son rekordan bu yana yapılan seans sayısı (rekor seansı hariç). */
  sessions: number
  /** Egzersizin en iyi tahmini 1RM'i (kg). */
  best: number
}

/**
 * Egzersizde ilerleme durdu mu? `workouts` eski→yeni sıralıdır. Ölçü `isPR` ile aynıdır: seansın en iyi
 * tahmini 1RM'i, önceki tüm seansları geçerse rekor sayılır (ilk seans da bir rekordur).
 * Son rekordan bu yana en az PLATEAU_SESSIONS seans geçtiyse ve son seans hâlâ en iyinin %95'i ve
 * üstündeyse plato döner; belirgin düşüş bilinçli deload olabileceğinden uyarı verilmez. Veri yetmiyorsa undefined.
 */
export function detectPlateau(workouts: Workout[], exId: string): Plateau | undefined {
  const points = exerciseHistory(workouts, exId)
  if (points.length <= PLATEAU_SESSIONS) return undefined

  let best = 0
  let lastPr = 0
  points.forEach((p, i) => {
    if (p.e1rm > best) {
      best = p.e1rm
      lastPr = i
    }
  })
  const sessions = points.length - 1 - lastPr
  if (sessions < PLATEAU_SESSIONS) return undefined
  if (points[points.length - 1].e1rm < best * NEAR_BEST) return undefined
  return { sessions, best }
}
