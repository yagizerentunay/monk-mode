import type { CustomExercise, SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import type { ParsedImport } from './importTypes.ts'
import { unitToKg, type Unit } from './units.ts'
import { newId } from './workout.ts'

/** Kütüphane eşleştiricisinin işe yarayan en küçük arayüzü (bkz. matchExercise.ts). */
export type NameMatcher = (name: string) => { id: string; name: string } | null

/** Önizlemede gösterilen, dosyadaki bir egzersiz adının nereye gideceği. */
export interface NameMapping {
  name: string
  /** Hedef egzersiz kimliği (kütüphane ya da özel). */
  exId: string
  /** Hedefin görünen adı. */
  target: string
  /** Kütüphanede karşılığı bulunamadı; özel egzersiz olarak alınır. */
  custom: boolean
  sets: number
}

export interface ImportPlan {
  workouts: Workout[]
  /** Bu içe aktarmada yeni oluşturulan özel egzersizler. */
  newCustom: CustomExercise[]
  mappings: NameMapping[]
  /** Aynı başlangıç zamanı ve adla zaten kayıtlı olduğu için atlanan antrenman sayısı. */
  duplicates: number
  sets: number
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Ayrıştırılmış dosyayı uygulamanın antrenman modeline çevirir. Hiçbir şeyi kaydetmez; sonuç
 * önizlenip onaylanınca store'a verilir. Ağırlıklar `unit` biriminden kg'a çevrilir.
 *
 * - Egzersiz adı kütüphanede eşleşmezse özel egzersiz olur (daha önce aynı adla özel egzersiz
 *   varsa o kullanılır), böylece geçmiş kaybolmaz ama yanlış egzersize de yazılmaz.
 * - Aynı başlangıç zamanı + ad zaten kayıtlıysa antrenman atlanır: dosyayı iki kez yüklemek veriyi
 *   ikiye katlamaz.
 * - Yalnız ısınması olan egzersiz alınmaz (seans bitişindeki kuralla aynı).
 */
export function buildImport(
  parsed: ParsedImport,
  unit: Unit,
  match: NameMatcher,
  existing: readonly Workout[],
  existingCustom: readonly CustomExercise[],
): ImportPlan {
  const have = new Set(existing.map((w) => `${w.start}|${w.name}`))
  const byName = new Map<string, NameMapping>()
  const newCustom: CustomExercise[] = []

  const resolve = (name: string): NameMapping => {
    const key = name.trim().toLowerCase()
    const known = byName.get(key)
    if (known) return known
    const hit = match(name)
    let mapping: NameMapping
    if (hit) {
      mapping = { name, exId: hit.id, target: hit.name, custom: false, sets: 0 }
    } else {
      const prior =
        existingCustom.find((c) => sameName(c.name, name)) ?? newCustom.find((c) => sameName(c.name, name))
      const custom: CustomExercise = prior ?? {
        id: `custom-${newId()}`,
        name: name.trim(),
        primaryMuscles: [],
        equipment: '',
      }
      if (!prior) newCustom.push(custom)
      mapping = { name, exId: custom.id, target: custom.name, custom: true, sets: 0 }
    }
    byName.set(key, mapping)
    return mapping
  }

  const workouts: Workout[] = []
  let duplicates = 0
  let sets = 0

  for (const iw of parsed.workouts) {
    if (have.has(`${iw.start}|${iw.name}`)) {
      duplicates++
      continue
    }
    const entries: WorkoutEntry[] = []
    let prevSuperset: string | undefined
    for (const ie of iw.entries) {
      const done: SetEntry[] = ie.sets.map((s) => {
        // roundTo(…, 0.01) 52.160000000000004 gibi kayan nokta artığı bırakır; yüzle çarpıp bölmek bırakmaz.
        const set: SetEntry = { w: Math.max(0, Math.round(unitToKg(s.weight, unit) * 100) / 100), r: s.reps, done: true }
        if (s.type === 'warmup') set.warmup = true
        if (s.type === 'drop') set.drop = true
        return set
      })
      if (!done.some((s) => !s.warmup)) {
        prevSuperset = undefined
        continue
      }
      const mapping = resolve(ie.name)
      mapping.sets += done.length
      sets += done.length
      const entry: WorkoutEntry = { exId: mapping.exId, sets: done }
      if (ie.supersetId && ie.supersetId === prevSuperset) entry.linked = true
      prevSuperset = ie.supersetId
      entries.push(entry)
    }
    if (entries.length === 0) continue
    workouts.push({
      id: newId(),
      d: iw.date,
      start: iw.start,
      end: iw.durationSec ? iw.start + iw.durationSec * 1000 : undefined,
      name: iw.name,
      entries,
    })
  }

  const mappings = [...byName.values()].filter((m) => m.sets > 0).sort((a, b) => b.sets - a.sets)

  return { workouts, newCustom, mappings, duplicates, sets }
}
