import type { SetEntry, Workout } from '../store/schema.ts'
import { parseDay } from './calendar.ts'
import { effectiveLoad } from './load.ts'
import { estimate1RM } from './onerm.ts'
import { workSets } from './workout.ts'

/** Rekor satırında "yeni" rozetinin kaç gün geriye baktığı (bugün dahil). */
export const RECENT_RECORD_DAYS = 30

/** Bir rekorun hangi set ve gün tarafından kurulduğu. */
export interface RecordSet {
  d: string
  set: SetEntry
}

/** Bir egzersizin kişisel rekorları. */
export interface ExerciseRecord {
  exId: string
  /** Vücut ağırlığı egzersizi: set ağırlığı ek yüktür (negatif = asist). */
  bw: boolean
  /** En az bir tamamlanmış çalışma seti olan seans sayısı. */
  sessions: number
  /**
   * En yüksek tahmini 1RM (`isPR` ile aynı ölçü: etkin yükten, ısınma ve tamamlanmamış set hariç); eşitlikte
   * ilk ulaşan seans korunur. Etkin yük 0 ise (örn. vücut ağırlığı kaydı yok) 1RM hesaplanamaz, alan yoktur.
   */
  e1rm?: RecordSet & { value: number }
  /**
   * En ağır çalışma seti: kayıtlı ağırlığa göre (vücut ağırlığında ek yük), eşitlikte daha çok tekrar, o da
   * eşitse ilk seans. Vücut ağırlığı egzersizinde 1RM yoksa rekoru bu set (en çok tekrar/ek yük) temsil eder.
   */
  top: RecordSet
  /** Rekorun kırıldığı gün: 1RM varsa onun günü, yoksa `top`ın günü. */
  d: string
}

/**
 * Tüm egzersizlerin rekorları, en yeni rekor günü başta. `workouts` eski→yeni sıralıdır (store'daki sıra).
 * Mantık `exerciseSummary` ve `isPR` ile aynıdır: çalışma seti = `workSets`, aynı seansta aynı egzersiz
 * birden fazla kez geçerse ilki sayılır, eşitlik ilk seansa gider. Yalnız tamamlanmış çalışma seti
 * olan egzersizler listelenir; veri yoksa değer uydurulmaz.
 */
export function personalRecords(workouts: Workout[]): ExerciseRecord[] {
  const byEx = new Map<string, ExerciseRecord>()
  for (const wk of workouts) {
    const seen = new Set<string>()
    for (const entry of wk.entries) {
      if (seen.has(entry.exId)) continue
      seen.add(entry.exId)
      const sets = workSets(entry.sets)
      if (sets.length === 0) continue
      let rec = byEx.get(entry.exId)
      if (!rec) {
        rec = { exId: entry.exId, bw: !!entry.bw, sessions: 0, top: { d: wk.d, set: sets[0] }, d: wk.d }
        byEx.set(entry.exId, rec)
      }
      rec.sessions++
      rec.bw = !!entry.bw
      for (const s of sets) {
        const e = estimate1RM(effectiveLoad(entry, s.w), s.r)
        if (e > (rec.e1rm?.value ?? 0)) rec.e1rm = { d: wk.d, set: s, value: e }
        const t = rec.top.set
        if (s.w > t.w || (s.w === t.w && s.r > t.r)) rec.top = { d: wk.d, set: s }
      }
    }
  }
  const out = [...byEx.values()]
  for (const r of out) r.d = r.e1rm?.d ?? r.top.d
  // En yeni rekor önce; aynı günde yüksek 1RM, sonra kimlik (deterministik).
  return out.sort((a, b) => {
    if (a.d !== b.d) return a.d < b.d ? 1 : -1
    return (b.e1rm?.value ?? 0) - (a.e1rm?.value ?? 0) || (a.exId < b.exId ? -1 : 1)
  })
}

/** Yerel takvim günü farkı (yaz saati kayması günü bozmaz): `from`dan `to`ya kaç gün. */
function daysBetween(from: string, to: Date): number {
  const a = parseDay(from)
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Rekor son `RECENT_RECORD_DAYS` günde mi kırıldı? (Bugün dahil; gelecek tarih de yeni sayılır.) */
export function isRecentRecord(d: string, today: Date): boolean {
  return daysBetween(d, today) < RECENT_RECORD_DAYS
}
