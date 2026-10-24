import type { SetEntry, Workout } from '../store/schema.ts'
import { countsForPace, paceSecPerKm, setMeters } from './distance.ts'
import { effectiveLoad } from './load.ts'
import { estimate1RM } from './onerm.ts'
import { workSets } from './workout.ts'

/** Bir egzersizin kullanıcıya ait geçmiş özeti (Kütüphane detayında gösterilir). */
export interface ExerciseSummary {
  /** Bu egzersizde en az bir tamamlanmış çalışma seti olan seans sayısı. */
  sessions: number
  /** En son seans ve o seansın çalışma setleri (ısınma hariç); hiç yapılmadıysa yok. */
  last?: { d: string; sets: SetEntry[]; bw?: boolean; timed?: boolean; distance?: boolean }
  /**
   * En yüksek tahmini 1RM'i veren set; eşitlikte ilk ulaşan seans korunur. `w` setin kayıtlı ağırlığıdır
   * (vücut ağırlığı egzersizinde `bw` ile birlikte ek yük); `e1rm` toplam yükten hesaplanır.
   */
  best?: { d: string; w: number; r: number; e1rm: number; bw?: boolean }
  /**
   * Süreli seansların en uzun tutuşu (sn, `w` o setin ek yükü); eşitlikte ilk ulaşan korunur. Süreli
   * seanslar `best`e (1RM) hiç girmez; geçmişte hem süreli hem tekrarlı kayıt varsa ikisi ayrı tutulur.
   */
  bestHold?: { d: string; w: number; sec: number; bw?: boolean }
  /**
   * Mesafe seanslarının özeti (bkz. lib/distance.ts): toplam mesafe (m) ve süre (sn), en uzun set (eşitlikte
   * kısa süre, o da eşitse ilk seans) ve en iyi tempo (sn/km; en az PACE_MIN_M olan setlerden, eşitlikte ilk).
   * Mesafe seansları `best` ve `bestHold`a girmez.
   */
  distance?: {
    totalM: number
    totalSec: number
    longest?: { d: string; m: number; sec: number }
    bestPace?: { d: string; m: number; sec: number; pace: number }
  }
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
    summary.last = {
      d: wk.d,
      sets,
      ...(entry.bw ? { bw: true } : {}),
      ...(entry.timed ? { timed: true } : {}),
      ...(entry.distance ? { distance: true } : {}),
    }
    if (entry.distance) {
      const dist = (summary.distance ??= { totalM: 0, totalSec: 0 })
      for (const s of sets) {
        const m = setMeters(s)
        dist.totalM += m
        dist.totalSec += s.r
        const l = dist.longest
        if (m > 0 && (!l || m > l.m || (m === l.m && s.r > 0 && (l.sec === 0 || s.r < l.sec)))) {
          dist.longest = { d: wk.d, m, sec: s.r }
        }
        if (countsForPace(s)) {
          const pace = paceSecPerKm(m, s.r) as number
          if (!dist.bestPace || pace < dist.bestPace.pace) dist.bestPace = { d: wk.d, m, sec: s.r, pace }
        }
      }
      continue
    }
    if (entry.timed) {
      for (const s of sets) {
        if (s.r > (summary.bestHold?.sec ?? 0)) summary.bestHold = { d: wk.d, w: s.w, sec: s.r, ...(entry.bw ? { bw: true } : {}) }
      }
      continue
    }
    for (const s of sets) {
      const e1rm = estimate1RM(effectiveLoad(entry, s.w), s.r)
      if (e1rm > (summary.best?.e1rm ?? 0)) summary.best = { d: wk.d, w: s.w, r: s.r, e1rm, ...(entry.bw ? { bw: true } : {}) }
    }
  }
  return summary
}
