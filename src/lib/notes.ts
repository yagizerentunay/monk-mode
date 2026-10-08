import type { Workout } from '../store/schema.ts'

export const NOTE_MAX = 500

/** Yazarken ham metin saklanır (boşluk bırakılabilsin); kayıt anında kırpılır, boşsa null olur. */
export function cleanNote(text: string | undefined): string | undefined {
  const t = (text ?? '').trim().slice(0, NOTE_MAX)
  return t === '' ? undefined : t
}

export interface NoteHit {
  note: string
  /** Notun yazıldığı antrenman günü, YYYY-MM-DD. */
  d: string
}

/**
 * Egzersizin son `lookback` seansı içindeki en yeni notu verir. Daha eski bir notu sonsuza dek
 * göstermek yanıltır (ağrı geçmiş olabilir); o yüzden yalnız yakın seanslara bakılır. `workouts`
 * eskiden yeniye sıralıdır.
 */
export function lastNoteFor(workouts: readonly Workout[], exId: string, lookback = 3): NoteHit | undefined {
  let seen = 0
  for (let i = workouts.length - 1; i >= 0 && seen < lookback; i--) {
    const entry = workouts[i].entries.find((e) => e.exId === exId)
    if (!entry) continue
    seen++
    if (entry.note) return { note: entry.note, d: workouts[i].d }
  }
  return undefined
}
