import type { CustomExercise, State, StrengthGoal, Workout } from '../store/schema.ts'
import { mergeRoutines } from './mergeRoutines.ts'
import { sameMuscleFix, type MuscleFix } from './muscleFix.ts'

/** Bir veri türü için birleştirme sayıları. */
export interface MergeCount {
  /** Yerelde olmadığı için eklenenler. */
  added: number
  /** Yerelde zaten aynen bulunanlar (aynı kimlik ve aynı içerik, ya da içerik kopyası). */
  identical: number
  /** Aynı kimlik/gün/anahtar iki tarafta var ama içerik farklı; yereldeki korundu. */
  conflicting: number
}

export interface MergeReport {
  workouts: MergeCount
  routines: MergeCount
  bodyweight: MergeCount
  measurements: MergeCount
  customEx: MergeCount
  muscleFix: MergeCount
  goals: MergeCount
  /** `workouts.identical` içinden: kimliği farklı ama içeriği aynı olduğu için atlananlar (CSV içe aktarma kopyası). */
  contentDuplicates: number
}

const count = (): MergeCount => ({ added: 0, identical: 0, conflicting: 0 })

/** Toplam eklenen kayıt sayısı; 0 ise birleştirme veriyi değiştirmez. */
export function totalAdded(r: MergeReport): number {
  return (
    r.workouts.added +
    r.routines.added +
    r.bodyweight.added +
    r.measurements.added +
    r.customEx.added +
    r.muscleFix.added +
    r.goals.added
  )
}

/** Derin eşitlik: anahtar sırasından bağımsız (iki cihazda JSON anahtar sırası farklı olabilir). */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  )
}

const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b)

const nameKey = (s: string): string => s.trim().toLowerCase()

/**
 * Antrenmanın içerik imzası: gün + başlangıç zamanı + egzersizler. Kimlik, ad, bitiş ve not imzaya
 * girmez. CSV içe aktarma her cihazda yeni kimlik ve özel egzersiz kimliği (custom-…) üretir; bu yüzden
 * özel egzersizler kimlik yerine adıyla yazılır, böylece iki cihazda ayrı içe aktarılan aynı CSV
 * aynı imzayı verir.
 */
function signature(w: Workout, customName: ReadonlyMap<string, string>): string {
  const entries = w.entries.map((e) => (customName.has(e.exId) ? { ...e, exId: `custom:${customName.get(e.exId)}` } : e))
  return `${w.d}|${w.start}|${canon(entries)}`
}

const names = (customEx: readonly CustomExercise[]): Map<string, string> =>
  new Map(customEx.map((c) => [c.id, nameKey(c.name)]))

/**
 * Başka cihazdan gelen yedeği (`incoming`) mevcut veriyle (`local`) hiçbir şeyi silmeden birleştirir.
 * Girdileri değiştirmez. Çakışmada yerel kazanır.
 *
 * - antrenmanlar: kimliğe göre birleşim. Aynı kimlik iki tarafta varsa yerel korunur (içerik aynıysa
 *   "identical", farklıysa "conflicting"). Kimliği farklı ama içerik imzası (gün + başlangıç +
 *   egzersizler) yerelde de varsa kopya sayılır ve atlanır. Sonuç (d, start) sırasındadır.
 * - rutinler: kimliğe göre; yeni gelenler mergeRoutines kurallarıyla eklenir (aynı adlı farklı kimlikli
 *   rutin "(2)" ekiyle gelir).
 * - kilo: güne göre; aynı günde yerel kalır. Tarihe göre sıralı.
 * - ölçüler: kilo gibi güne göre; aynı günde yerel kayıt bütün olarak kalır (alanlar karıştırılmaz).
 * - özel egzersiz: kimliğe göre. Kas düzeltmesi: yalnız yerelde olmayan egzersizler için eklenir.
 * - hedefler: kimliğe göre. Kimliği farklı ama egzersiz + hedef + gün aynıysa (iki cihazda ayrı girilmiş
 *   aynı hedef) zaten var sayılır. Yeni gelenler sona eklenir.
 * - ayarlar, haftalık program, aktif antrenman: yerel aynen kalır.
 */
export function mergeState(local: State, incoming: State): { state: State; report: MergeReport } {
  const report: MergeReport = {
    workouts: count(),
    routines: count(),
    bodyweight: count(),
    measurements: count(),
    customEx: count(),
    muscleFix: count(),
    goals: count(),
    contentDuplicates: 0,
  }

  // Antrenmanlar
  const localById = new Map(local.workouts.map((w) => [w.id, w]))
  const localNames = names(local.customEx)
  const incomingNames = names(incoming.customEx)
  const localSigs = new Set(local.workouts.map((w) => signature(w, localNames)))
  const addedWorkouts: Workout[] = []
  const seen = new Set<string>()
  for (const w of incoming.workouts) {
    if (seen.has(w.id)) continue
    seen.add(w.id)
    const mine = localById.get(w.id)
    if (mine) {
      if (same(mine, w)) report.workouts.identical++
      else report.workouts.conflicting++
    } else if (localSigs.has(signature(w, incomingNames))) {
      report.workouts.identical++
      report.contentDuplicates++
    } else {
      addedWorkouts.push(w)
      report.workouts.added++
    }
  }
  const workouts = [...local.workouts, ...addedWorkouts].sort(
    (a, b) => a.d.localeCompare(b.d) || a.start - b.start,
  )

  // Rutinler
  const localRoutines = new Map(local.routines.map((r) => [r.id, r]))
  const freshRoutines = []
  for (const r of incoming.routines) {
    const mine = localRoutines.get(r.id)
    if (!mine) freshRoutines.push(r)
    else if (same(mine, r)) report.routines.identical++
    else report.routines.conflicting++
  }
  const merged = mergeRoutines({ routines: local.routines, customEx: [] }, { routines: freshRoutines, customEx: [] })
  report.routines.added = merged.added
  // Geçersiz biçimli rutinler eklenmez; kullanıcıya "farklı" olarak yansır.
  report.routines.conflicting += merged.invalid

  // Vücut ağırlığı
  const localDays = new Map(local.bodyweight.map((b) => [b.d, b]))
  const addedBw = []
  for (const b of incoming.bodyweight) {
    const mine = localDays.get(b.d)
    if (!mine) {
      localDays.set(b.d, b)
      addedBw.push(b)
      report.bodyweight.added++
    } else if (mine.w === b.w) report.bodyweight.identical++
    else report.bodyweight.conflicting++
  }
  const bodyweight = [...local.bodyweight, ...addedBw].sort((a, b) => a.d.localeCompare(b.d))

  // Vücut ölçüleri
  const localMeasureDays = new Map(local.measurements.map((m) => [m.d, m]))
  const addedMeasures = []
  for (const m of incoming.measurements) {
    const mine = localMeasureDays.get(m.d)
    if (!mine) {
      localMeasureDays.set(m.d, m)
      addedMeasures.push(m)
      report.measurements.added++
    } else if (same(mine, m)) report.measurements.identical++
    else report.measurements.conflicting++
  }
  const measurements = [...local.measurements, ...addedMeasures].sort((a, b) => a.d.localeCompare(b.d))

  // Özel egzersizler
  const localCustom = new Map(local.customEx.map((c) => [c.id, c]))
  const addedCustom: CustomExercise[] = []
  for (const c of incoming.customEx) {
    const mine = localCustom.get(c.id)
    if (!mine) {
      localCustom.set(c.id, c)
      addedCustom.push(c)
      report.customEx.added++
    } else if (same(mine, c)) report.customEx.identical++
    else report.customEx.conflicting++
  }

  // Kas düzeltmeleri
  const addedFix: [string, MuscleFix][] = []
  for (const [id, fix] of Object.entries(incoming.muscleFix)) {
    if (!Object.hasOwn(local.muscleFix, id)) {
      addedFix.push([id, fix])
      report.muscleFix.added++
    } else if (sameMuscleFix(local.muscleFix[id], fix)) report.muscleFix.identical++
    else report.muscleFix.conflicting++
  }
  // fromEntries: `__proto__` gibi anahtarlar prototipi değiştirmez.
  const muscleFix = Object.fromEntries([...Object.entries(local.muscleFix), ...addedFix])

  // Hedefler
  const goalKey = (g: StrengthGoal): string => `${g.exId}|${g.target}|${g.by}`
  const localGoals = new Map(local.goals.map((g) => [g.id, g]))
  const goalKeys = new Set(local.goals.map(goalKey))
  const addedGoals: StrengthGoal[] = []
  for (const g of incoming.goals) {
    const mine = localGoals.get(g.id)
    if (mine) {
      if (same(mine, g)) report.goals.identical++
      else report.goals.conflicting++
    } else if (goalKeys.has(goalKey(g))) report.goals.identical++
    else {
      localGoals.set(g.id, g)
      goalKeys.add(goalKey(g))
      addedGoals.push(g)
      report.goals.added++
    }
  }

  const state: State = {
    ...local,
    workouts,
    routines: merged.routines,
    bodyweight,
    measurements,
    customEx: [...local.customEx, ...addedCustom],
    muscleFix,
    goals: [...local.goals, ...addedGoals],
  }
  return { state, report }
}

/** Birleştirme sonucunu kısa bir Türkçe durum satırına çevirir. */
export function describeMerge(r: MergeReport): string {
  const added = [
    r.workouts.added && `${r.workouts.added} antrenman`,
    r.routines.added && `${r.routines.added} rutin`,
    r.bodyweight.added && `${r.bodyweight.added} kilo kaydı`,
    r.measurements.added && `${r.measurements.added} ölçü kaydı`,
    r.customEx.added && `${r.customEx.added} özel egzersiz`,
    r.muscleFix.added && `${r.muscleFix.added} kas düzeltmesi`,
    r.goals.added && `${r.goals.added} hedef`,
  ].filter(Boolean)
  const kinds = [r.workouts, r.routines, r.bodyweight, r.measurements, r.customEx, r.muscleFix, r.goals]
  const identical = kinds.reduce((n, c) => n + c.identical, 0)
  const conflicting = kinds.reduce((n, c) => n + c.conflicting, 0)
  const parts = [
    added.length ? `${added.join(', ')} eklendi` : 'yeni kayıt yok',
    identical ? `${identical} kayıt zaten vardı` : '',
    conflicting ? `${conflicting} kayıt farklı, yereldeki korundu` : '',
  ].filter(Boolean)
  return `${parts.join('; ')}.`
}
