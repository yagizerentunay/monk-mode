import { saveRest } from '../lib/restState.ts'
import { snapshotNow } from './autoSnapshot.ts'
import { useToast } from './toast.ts'
import { useStore } from './useStore.ts'

/**
 * Yıkıcı silmeler: önce otomatik anlık kopya (metin çağrı anında üretilir, bkz. snapshots.ts; yazma
 * arkada sürer), sonra silme, sonra "Geri al" bildirimi. Geri al yalnız silinen öğeyi yerine koyar
 * (tam kopyaya dönmez); bildirim kapandıktan sonra kurtarma yolu Ayarlar > Otomatik kopyalardır.
 */

function backup(reason: string): void {
  // Kopya bir güvenlik ağı: yazılamasa da silme engellenmez.
  void snapshotNow(reason).catch(() => {})
}

/** Geçmişteki bir antrenmanı siler; geri alınca (d, start) sırasındaki yerine döner. */
export function deleteWorkoutWithUndo(id: string): void {
  const workout = useStore.getState().workouts.find((w) => w.id === id)
  if (!workout) return
  backup('Antrenman silinmeden önce')
  useStore.getState().deleteWorkout(id)
  useToast.getState().show('Antrenman silindi', () => useStore.getState().addWorkout(workout))
}

/** Rutini siler; geri alınca eski sırasına ve (hâlâ boşsa) hafta günlerine döner. */
export function deleteRoutineWithUndo(id: string): void {
  const { routines, week } = useStore.getState()
  const index = routines.findIndex((r) => r.id === id)
  if (index < 0) return
  const routine = routines[index]
  const days = Object.entries(week)
    .filter(([, rid]) => rid === id)
    .map(([day]) => Number(day))
  backup('Rutin silinmeden önce')
  useStore.getState().deleteRoutine(id)
  useToast.getState().show('Rutin silindi', () => useStore.getState().restoreRoutine(routine, index, days))
}

/** Kuvvet hedefini siler; geri alınca eski sırasına döner. */
export function deleteGoalWithUndo(id: string): void {
  const index = useStore.getState().goals.findIndex((g) => g.id === id)
  if (index < 0) return
  const goal = useStore.getState().goals[index]
  backup('Hedef silinmeden önce')
  useStore.getState().deleteGoal(id)
  useToast.getState().show('Hedef silindi', () => useStore.getState().restoreGoal(goal, index))
}

/**
 * Devam eden antrenmanı atar; geri alınca yeniden aktif olur. `restEnds`: atılırken çalışan dinlenme
 * sayacının bitişi (varsa ve dolmadıysa geri gelir).
 */
export function discardActiveWithUndo(restEnds: number | null = null): void {
  const workout = useStore.getState().active
  if (!workout) return
  backup('Devam eden antrenman silinmeden önce')
  useStore.getState().discardWorkout()
  useToast.getState().show('Devam eden antrenman silindi', () => {
    useStore.getState().restoreActive(workout)
    // Başka bir antrenman başlamışsa restoreActive dokunmaz; sayaç da ona ait kalır.
    if (restEnds !== null && restEnds > Date.now() && useStore.getState().active?.id === workout.id) {
      saveRest(workout.id, restEnds)
    }
  })
}
