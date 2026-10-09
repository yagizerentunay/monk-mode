import type { SetEntry, Workout } from '../store/schema.ts'
import { cleanNote, NOTE_MAX } from './notes.ts'
import { deriveSet } from './sets.ts'

/**
 * Kaydedilmiş bir antrenmanı düzenlemek için saf yardımcılar. Hepsi yeni bir Workout döner, girdiyi
 * değiştirmez; arayüz bir taslak üzerinde çalışır ve "Kaydet" ile store'a yazar. İlerleme önerisi,
 * 1RM ve PR hesapları kayıtlı veriden türetildiği için düzeltme onları otomatik düzeltir.
 */

export interface SetPatch {
  /** Ağırlık (kg). */
  w?: number
  /** Tek taraflı olmayan sette tekrar. */
  r?: number
  /** Tek taraflı sette sol / sağ tekrar. */
  L?: number
  R?: number
}

const nonNegative = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0)
const reps = (v: number): number => Math.round(nonNegative(v))

function mapSet(w: Workout, ei: number, si: number, fn: (s: SetEntry) => SetEntry): Workout {
  return {
    ...w,
    entries: w.entries.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? fn(s) : s)) },
    ),
  }
}

/**
 * Bir setin ağırlığını ya da tekrarını düzeltir; tek taraflıda sol/sağ ayrı düzeltilir. Vücut ağırlığı
 * egzersizinde ağırlık ek yüktür ve negatif (asist) olabilir.
 */
export function editSet(workout: Workout, ei: number, si: number, patch: SetPatch): Workout {
  const signed = !!workout.entries[ei]?.bw
  return mapSet(workout, ei, si, (s) => {
    let next: SetEntry = { ...s }
    if (patch.w !== undefined) next.w = signed ? (Number.isFinite(patch.w) ? patch.w : 0) : nonNegative(patch.w)
    if (next.sides) {
      const sides = { L: { ...next.sides.L }, R: { ...next.sides.R } }
      if (patch.L !== undefined) sides.L.r = reps(patch.L)
      if (patch.R !== undefined) sides.R.r = reps(patch.R)
      next = deriveSet({ ...next, sides })
      // Yarım setin eksik tarafı girildi: artık tam bir set (iki taraf da yapılmış sayılır).
      if (next.partial && sides.L.r > 0 && sides.R.r > 0) {
        const { partial: _p, ...rest } = next
        next = deriveSet({ ...rest, sides: { L: { ...sides.L, done: true }, R: { ...sides.R, done: true } } })
      }
    } else if (patch.r !== undefined) {
      next.r = reps(patch.r)
    }
    return next
  })
}

export function removeSetAt(workout: Workout, ei: number, si: number): Workout {
  return {
    ...workout,
    entries: workout.entries.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })),
  }
}

/** Egzersize, son çalışma setinin kopyası olan yeni bir tamamlanmış set ekler. */
export function addSetTo(workout: Workout, ei: number): Workout {
  return {
    ...workout,
    entries: workout.entries.map((e, i) => {
      if (i !== ei) return e
      const last = [...e.sets].reverse().find((s) => !s.warmup && !s.drop && !s.partial)
      const base: SetEntry = last
        ? { w: last.w, r: last.r, done: true }
        : { w: 0, r: 0, done: true }
      const next: SetEntry = last?.sides
        ? deriveSet({ ...base, sides: { L: { r: last.sides.L.r, done: true }, R: { r: last.sides.R.r, done: true } } })
        : base
      return { ...e, sets: [...e.sets, next] }
    }),
  }
}

/**
 * Egzersizi antrenmandan çıkarır. Çıkarılan bir süpersetin başıysa ona bağlı sıradaki egzersiz
 * bağsız yeni baş olur; yoksa bağı önceki gruba yapışırdı.
 */
export function removeEntryAt(workout: Workout, ei: number): Workout {
  const entries = workout.entries.filter((_, i) => i !== ei)
  if (!workout.entries[ei]?.linked && entries[ei]?.linked) entries[ei] = { ...entries[ei], linked: false }
  return { ...workout, entries }
}

export function setEntryNoteIn(workout: Workout, ei: number, text: string): Workout {
  return {
    ...workout,
    entries: workout.entries.map((e, i) => (i === ei ? { ...e, note: text.slice(0, NOTE_MAX) } : e)),
  }
}

export function setWorkoutNoteIn(workout: Workout, text: string): Workout {
  return { ...workout, note: text.slice(0, NOTE_MAX) }
}

/**
 * Düzenlemeyi kaydedilecek hâle getirir: notları kırpar, setsiz ve notsuz egzersizleri atar.
 * Hiç set kalmadıysa null döner (antrenman kaydı boş olamaz; arayüz bu durumda silmeyi önerir).
 */
export function finalizeEdit(workout: Workout): Workout | null {
  const entries = workout.entries
    .map((e) => {
      const { note: _n, ...rest } = e
      const note = cleanNote(e.note)
      return { ...rest, ...(note ? { note } : {}) }
    })
    .filter((e) => e.sets.some((s) => !s.warmup) || e.note)
  if (!entries.some((e) => e.sets.some((s) => !s.warmup))) return null
  const { note: _w, ...base } = workout
  const note = cleanNote(workout.note)
  return { ...base, entries, ...(note ? { note } : {}) }
}
