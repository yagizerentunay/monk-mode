import type { SetEntry, Workout } from '../store/schema.ts'
import { estimate1RM } from './onerm.ts'
import { workSets } from './workout.ts'

/** Bir egzersizin kullanıcıya ait geçmiş özeti (Kütüphane detayında gösterilir). */
export interface ExerciseSummary {
  /** Bu egzersizde en az bir tamamlanmış çalışma seti olan seans sayısı. */
  sessions: number
  /** En son seans ve o seansın çalışma setleri (ısınma hariç); hiç yapılmadıysa yok. */
  last?: { d: string; sets: SetEntry[] }
  /** En yüksek tahmini 1RM'i veren set; eşitlikte ilk ulaşan seans korunur. */
  best?: { d: string; w: number; r: number; e1rm: number }
}

/** `workouts` eski→yeni sıralıdır (store'daki sıra). Veri yoksa değer uydurulmaz. */
export function exerciseSummary(workouts: Workout[], exId: string): ExerciseSummary {
  const summary: ExerciseSummary = { sessions: 0 }
  for (const wk of workouts) {
    const entry = wk.entries.find((e) => e.exId === exId)
    if (!entry) continue
    const sets = workSets(entry.sets)
    if (sets.length === 0) continue
    summary.sessions++
    summary.last = { d: wk.d, sets }
    for (const s of sets) {
      const e1rm = estimate1RM(s.w, s.r)
      if (e1rm > (summary.best?.e1rm ?? 0)) summary.best = { d: wk.d, w: s.w, r: s.r, e1rm }
    }
  }
  return summary
}
