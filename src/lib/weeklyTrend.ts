import type { Workout } from '../store/schema.ts'
import { parseDay } from './calendar.ts'
import { weekStartOf } from './streak.ts'
import { dayString, doneSetCount, workoutVolume } from './workout.ts'

/** Analiz'deki haftalık özetin kaç hafta geriye baktığı. */
export const TREND_WEEKS = 12

export interface WeekTotal {
  /** Haftanın ilk günü (YYYY-MM-DD, ayarlardaki hafta başlangıcına göre). */
  start: string
  /** Tamamlanan çalışma setleri (ısınma ve dropset hariç; bkz. doneSetCount). */
  sets: number
  /** Hacim, kg (ısınma hariç, vücut ağırlığı egzersizinde etkin yük; bkz. workoutVolume). */
  volume: number
  workouts: number
}

/**
 * Son `weeks` haftanın (içinde bulunulan dahil) toplamları, eskiden yeniye. Antrenmansız hafta 0 olarak
 * yer alır ki grafikte boşluk da görünsün. Gün anahtarları yerel takvime göredir (`workout.d`).
 */
export function weeklyTotals(workouts: Workout[], today: Date, weekStart: number, weeks = TREND_WEEKS): WeekTotal[] {
  const current = weekStartOf(today, weekStart)
  const out: WeekTotal[] = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(current.getFullYear(), current.getMonth(), current.getDate() - (weeks - 1 - i) * 7)
    return { start: dayString(d), sets: 0, volume: 0, workouts: 0 }
  })
  const index = new Map(out.map((w, i) => [w.start, i]))
  for (const w of workouts) {
    const i = index.get(dayString(weekStartOf(parseDay(w.d), weekStart)))
    if (i === undefined) continue
    out[i].sets += doneSetCount(w).done
    out[i].volume += workoutVolume(w)
    out[i].workouts += 1
  }
  return out
}

/** Bu hafta ile önceki (en çok) 4 haftanın ortalaması; karşılaştırma için veri yoksa average null. */
export function weekComparison(totals: WeekTotal[], key: 'sets' | 'volume'): { current: number; average: number | null } {
  const current = totals[totals.length - 1]?.[key] ?? 0
  const previous = totals.slice(-5, -1).filter((w) => w.workouts > 0)
  const average = previous.length > 0 ? previous.reduce((s, w) => s + w[key], 0) / previous.length : null
  return { current, average }
}
