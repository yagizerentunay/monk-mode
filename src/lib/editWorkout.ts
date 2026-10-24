import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { cleanNote, NOTE_MAX } from './notes.ts'
import { deriveSet } from './sets.ts'
import { clampDistanceSec, clampMeters } from './distance.ts'
import { clampSec } from './timed.ts'

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
  /** Mesafe girdisinde mesafe (m). */
  m?: number
}

const nonNegative = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0)
const reps = (v: number, timed: boolean): number => (timed ? clampSec(v) : Math.round(nonNegative(v)))

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
 * egzersizinde ağırlık ek yüktür ve negatif (asist) olabilir. Süreli egzersizde "tekrar" saniyedir ve 0-3600'e çekilir.
 * Mesafe egzersizinde `r` setin süresidir (0-86.400 sn) ve `m` mesafedir (0-1.000.000 m).
 */
export function editSet(workout: Workout, ei: number, si: number, patch: SetPatch): Workout {
  const signed = !!workout.entries[ei]?.bw
  const timed = !!workout.entries[ei]?.timed
  if (workout.entries[ei]?.distance) {
    return mapSet(workout, ei, si, (s) => ({
      ...s,
      ...(patch.r !== undefined ? { r: clampDistanceSec(patch.r) } : {}),
      ...(patch.m !== undefined ? { m: clampMeters(patch.m) } : {}),
    }))
  }
  return mapSet(workout, ei, si, (s) => {
    let next: SetEntry = { ...s }
    if (patch.w !== undefined) next.w = signed ? (Number.isFinite(patch.w) ? patch.w : 0) : nonNegative(patch.w)
    if (next.sides) {
      const sides = { L: { ...next.sides.L }, R: { ...next.sides.R } }
      if (patch.L !== undefined) sides.L.r = reps(patch.L, timed)
      if (patch.R !== undefined) sides.R.r = reps(patch.R, timed)
      next = deriveSet({ ...next, sides })
      // Yarım setin eksik tarafı girildi: artık tam bir set (iki taraf da yapılmış sayılır).
      if (next.partial && sides.L.r > 0 && sides.R.r > 0) {
        const { partial: _p, ...rest } = next
        next = deriveSet({ ...rest, sides: { L: { ...sides.L, done: true }, R: { ...sides.R, done: true } } })
      }
    } else if (patch.r !== undefined) {
      next.r = reps(patch.r, timed)
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

/**
 * Egzersizi (`ei`) bir adım yukarı (-1) ya da aşağı (+1) taşır; uçta ya da geçersiz sırada girdiyi
 * olduğu gibi döner. Hem aktif seansta hem geçmiş antrenman düzenlemede kullanılır.
 *
 * Süperset kuralı (rutin düzenleyicideki `moveExercise` ile aynı, bkz. superset.ts): egzersiz TEK
 * BAŞINA taşınır, "öncekiyle bağlı" bayrakları ise KONUMA bağlı kalır (egzersizle gitmez). Sonuçlar:
 * - Grubun içinde sıra değişir, grup bozulmaz ([A,B,C] içinde B'yi yukarı almak A ile yer değiştirir).
 * - Grubun başını (A) aşağı almak başı B yapar, grup aynı üyelerle kalır.
 * - Grubun kuyruğunu grubun dışına doğru taşımak onu gruptan çıkarır, dıştaki komşu gruba girer;
 *   dışarıdan gelen egzersiz de bir gruba girerken bir üyeyi dışarıda bırakır.
 * Tüm grubu taşımak yerine bunu seçtik çünkü rutin düzenleyiciyle aynı davranır ve tek adımda
 * her konuma ulaşılabilir; bayraklar da hep tutarlı kalır (bağsız ilk egzersiz bağlanmış olamaz).
 *
 * Setler, tamamlanma durumu, not ve diğer alanlar egzersizle birlikte taşınır; yalnız `linked` konumda kalır.
 */
export function moveEntryAt(workout: Workout, ei: number, dir: -1 | 1): Workout {
  const ej = ei + dir
  const { entries } = workout
  if (!entries[ei] || !entries[ej]) return workout
  const withLink = (e: WorkoutEntry, linked: boolean | undefined): WorkoutEntry => {
    const { linked: _l, ...rest } = e
    return linked === undefined ? rest : { ...rest, linked }
  }
  const out = [...entries]
  out[ei] = withLink(entries[ej], entries[ei].linked)
  out[ej] = withLink(entries[ei], entries[ej].linked)
  return { ...workout, entries: out }
}

export function setEntryNoteIn(workout: Workout, ei: number, text: string): Workout {
  return {
    ...workout,
    entries: workout.entries.map((e, i) => (i === ei ? { ...e, note: text.slice(0, NOTE_MAX) } : e)),
  }
}

/**
 * Vücut ağırlığı egzersizinde o günün vücut ağırlığı (kg). Toplam yük `bwKg + w` olduğundan hacim,
 * PR ve grafikler kayıttan yeniden hesaplanır. 0 ya da geçersiz değer kaydı kaldırır ("bilinmiyor").
 */
export function setEntryBwKgIn(workout: Workout, ei: number, kg: number): Workout {
  return {
    ...workout,
    entries: workout.entries.map((e, i) => {
      if (i !== ei || !e.bw) return e
      if (Number.isFinite(kg) && kg > 0) return { ...e, bwKg: kg }
      const { bwKg: _bwKg, ...rest } = e
      return rest
    }),
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
