import type { CustomExercise, State, Workout } from '../store/schema.ts'
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
  customEx: MergeCount
  muscleFix: MergeCount
  /** `workouts.identical` içinden: kimliği farklı ama içeriği aynı olduğu için atlananlar (CSV içe aktarma kopyası). */
  contentDuplicates: number
}

const count = (): MergeCount => ({ added: 0, identical: 0, conflicting: 0 })

/** Toplam eklenen kayıt sayısı; 0 ise birleştirme veriyi değiştirmez. */
export function totalAdded(r: MergeReport): number {
  return r.workouts.added + r.routines.added + r.bodyweight.added + r.customEx.added + r.muscleFix.added
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
 * - özel egzersiz: kimliğe göre. Kas düzeltmesi: yalnız yerelde olmayan egzersizler için eklenir.
 * - ayarlar, haftalık program, aktif antrenman: yerel aynen kalır.
 */
export function mergeState(local: State, incoming: State): { state: State; report: MergeReport } {
  const report: MergeReport = {
    workouts: count(),
    routines: count(),
    bodyweight: count(),
    customEx: count(),
    muscleFix: count(),
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

  const state: State = {
    ...local,
    workouts,
    routines: merged.routines,
    bodyweight,
    customEx: [...local.customEx, ...addedCustom],
    muscleFix,
  }
  return { state, report }
}
