import { create } from 'zustand'
import { insertWorkout } from '../lib/backdate.ts'
import { fingerprint, SNOOZE_DAYS } from '../lib/backupReminder.ts'
import { bodyweightOn } from '../lib/load.ts'
import { dropSet, MAX_DROPS, MAX_WARMUPS, retargetWarmups, warmupSet } from '../lib/intensity.ts'
import { mergeRoutines, type RoutineMerge } from '../lib/mergeRoutines.ts'
import { normalizeMuscleFix, type MuscleFix } from '../lib/muscleFix.ts'
import { cleanNote, NOTE_MAX } from '../lib/notes.ts'
import { deriveSet, toBilateral, toUnilateral, type Side } from '../lib/sets.ts'
import { swapEntry } from '../lib/swap.ts'
import { buildWorkout, dayString, finalizeSet, newId } from '../lib/workout.ts'
import { migrate } from './migrate.ts'
import {
  defaultState,
  type BodyweightEntry,
  type CustomExercise,
  type ExCfg,
  type Routine,
  type SetEntry,
  type Settings,
  type SideSet,
  type State,
  type Workout,
} from './schema.ts'

export const STORAGE_KEY = 'monk_state_v1'

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? migrate(JSON.parse(raw)) : defaultState()
  } catch {
    return defaultState()
  }
}

function save(state: State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Depolama dolu veya kapalı: oturum bellekte çalışmaya devam eder.
  }
}

export interface Actions {
  setSettings(patch: Partial<Settings>): void
  saveRoutine(routine: Routine): void
  deleteRoutine(id: string): void
  assignDay(day: number, routineId: string | null): void
  startWorkout(routineId: string): void
  updateSet(entry: number, set: number, patch: Partial<SetEntry>): void
  updateSide(entry: number, set: number, side: Side, patch: Partial<SideSet>): void
  toggleUnilateral(entry: number): void
  toggleSuperset(entry: number): void
  /** Egzersiz / antrenman notu; yazarken ham metin saklanır, kayıtta kırpılır (finishWorkout). */
  setEntryNote(entry: number, text: string): void
  setWorkoutNote(text: string): void
  addSet(entry: number): void
  addWarmup(entry: number): void
  addDrop(entry: number, set: number): void
  removeSet(entry: number, set: number): void
  addExerciseToActive(exId: string, cfg?: Partial<ExCfg>): void
  /**
   * Aktif antrenmanda henüz hiç set tamamlanmamış (done/partial yok) bir egzersizi `exId` ile değiştirir;
   * aksi hâlde hiçbir şey yapmaz. Yalnız bu seansı etkiler (rutin değişmez). `side`: yeni egzersiz tek
   * taraflı mı (arayüz adından belirler, bkz. isUnilateralName); verilmezse bilateral. `bw`: yeni egzersiz
   * vücut ağırlığı egzersizi mi (arayüz ekipmandan belirler, bkz. isBodyOnly); verilmezse mutlak yük.
   */
  swapExercise(entry: number, exId: string, side?: boolean, bw?: boolean): void
  finishWorkout(): Workout | null
  discardWorkout(): void
  deleteWorkout(id: string): void
  /** Kaydedilmiş bir antrenmanı (kimliğiyle) düzeltilmiş hâliyle değiştirir; sıra ve tarih korunur. */
  updateWorkout(updated: Workout): void
  /** Geçmiş bir güne girilen antrenmanı (d, start) sırasında ekler; aynı kimlik varsa dokunmaz. */
  addWorkout(workout: Workout): void
  importWorkouts(workouts: Workout[], customEx: CustomExercise[]): void
  /** Yedek dosyasındaki rutinleri mevcut verinin üstüne ekler (bkz. lib/mergeRoutines.ts). */
  addRoutinesFrom(incoming: { routines: unknown; customEx: unknown }): RoutineMerge
  logBodyweight(entry: BodyweightEntry): void
  addCustomExercise(ex: Omit<CustomExercise, 'id'>): string
  /** Egzersizin kaslarını düzeltir (en az bir geçerli birincil kas yoksa yok sayılır, bkz. lib/muscleFix.ts). */
  setMuscleFix(exId: string, fix: MuscleFix): void
  /** Düzeltmeyi kaldırır; egzersiz kütüphanedeki kaslarına döner. */
  clearMuscleFix(exId: string): void
  replaceAll(state: State): void
  /** Şu anki verinin yedeklendiğini işaretler (yedek indirilince ya da yedekten yüklenince). */
  markBackedUp(now: number): void
  snoozeBackup(now: number): void
}

export type Store = State & Actions

type Setter = (fn: (s: Store) => Partial<Store>) => void

function withActive(set: Setter, fn: (w: Workout) => Workout): void {
  set((s) => (s.active ? { active: fn(s.active) } : {}))
}

export const useStore = create<Store>((set, get) => ({
  ...load(),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  saveRoutine: (routine) =>
    set((s) => {
      const exists = s.routines.some((r) => r.id === routine.id)
      return {
        routines: exists
          ? s.routines.map((r) => (r.id === routine.id ? routine : r))
          : [...s.routines, routine],
      }
    }),

  deleteRoutine: (id) =>
    set((s) => ({
      routines: s.routines.filter((r) => r.id !== id),
      week: Object.fromEntries(Object.entries(s.week).filter(([, rid]) => rid !== id)),
    })),

  assignDay: (day, routineId) =>
    set((s) => {
      const week = { ...s.week }
      if (routineId) week[day] = routineId
      else delete week[day]
      return { week }
    }),

  startWorkout: (routineId) => {
    const s = get()
    const routine = s.routines.find((r) => r.id === routineId)
    if (!routine || s.active) return
    set(() => ({ active: buildWorkout(routine, s.workouts, Date.now(), s.bodyweight) }))
  },

  updateSet: (entry, setIdx, patch) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => {
        if (i !== entry) return e
        let sets = e.sets.map((x, j) => (j === setIdx ? deriveSet({ ...x, ...patch }) : x))
        // İlk çalışma setinin ağırlığı değişince otomatik ısınmalar yeni rampaya çekilir.
        const first = e.sets.findIndex((s) => !s.warmup && !s.drop)
        if (patch.w !== undefined && setIdx === first) sets = retargetWarmups(sets, e.sets[first].w, patch.w)
        return { ...e, sets }
      }),
    })),

  updateSide: (entry, setIdx, side, patch) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) =>
        i !== entry
          ? e
          : {
              ...e,
              sets: e.sets.map((x, j) =>
                j !== setIdx || !x.sides
                  ? x
                  : deriveSet({ ...x, sides: { ...x.sides, [side]: { ...x.sides[side], ...patch } } }),
              ),
            },
      ),
    })),

  toggleUnilateral: (entry) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) =>
        i !== entry
          ? e
          : e.unilateral
            ? { ...e, unilateral: false, sets: toBilateral(e.sets) }
            : { ...e, unilateral: true, sets: toUnilateral(e.sets) },
      ),
    })),

  toggleSuperset: (entry) =>
    withActive(set, (w) => ({
      ...w,
      // İlk egzersiz bağlanacak öncekine sahip değildir.
      entries: w.entries.map((e, i) => (i !== entry || i === 0 ? e : { ...e, linked: !e.linked })),
    })),

  setEntryNote: (entry, text) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => (i === entry ? { ...e, note: text.slice(0, NOTE_MAX) } : e)),
    })),

  setWorkoutNote: (text) => withActive(set, (w) => ({ ...w, note: text.slice(0, NOTE_MAX) })),

  addSet: (entry) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => {
        if (i !== entry) return e
        // Yeni set, son asıl çalışma setini örnek alır (ısınma ve dropsetlerin hafif ağırlığını değil).
        const last = [...e.sets].reverse().find((s) => !s.warmup && !s.drop)
        const base: SetEntry = { w: last?.w ?? 0, r: last?.r ?? 0, done: false }
        // Yeni set, son setin tekrar hedeflerini her iki tarafa da taşır; tamamlanma sıfırlanır.
        const next: SetEntry = last?.sides
          ? deriveSet({ ...base, sides: { L: { r: last.sides.L.r, done: false }, R: { r: last.sides.R.r, done: false } } })
          : base
        return { ...e, sets: [...e.sets, next] }
      }),
    })),

  addWarmup: (entry) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => {
        if (i !== entry) return e
        const k = e.sets.filter((s) => s.warmup).length
        if (k >= MAX_WARMUPS) return e
        // Rampa, ilk çalışma setinin ağırlığından hesaplanır; yeni ısınma mevcut ısınmaların ardına girer.
        const work = e.sets.find((s) => !s.warmup && !s.drop)
        const sets = [...e.sets]
        sets.splice(k, 0, warmupSet(work?.w ?? 0, k))
        return { ...e, sets }
      }),
    })),

  addDrop: (entry, setIdx) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => {
        if (i !== entry || !e.sets[setIdx] || e.sets[setIdx].warmup) return e
        // Zincir: aynı setin ardındaki dropların sonuna eklenir ve sonuncusundan hesaplanır.
        let at = setIdx + 1
        while (e.sets[at]?.drop) at++
        if (at - setIdx - 1 >= MAX_DROPS) return e
        const sets = [...e.sets]
        sets.splice(at, 0, dropSet(e.sets[at - 1]))
        return { ...e, sets }
      }),
    })),

  removeSet: (entry, setIdx) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) =>
        i !== entry ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIdx) },
      ),
    })),

  addExerciseToActive: (exId, cfg) =>
    withActive(set, (w) => ({
      ...w,
      entries: [
        ...w.entries,
        (() => {
          const sets = Array.from({ length: cfg?.sets ?? 3 }, () => ({
            w: cfg?.weight ?? 0,
            r: cfg?.reps ?? 8,
            done: false,
          }))
          const bwKg = cfg?.bw ? bodyweightOn(get().bodyweight, w.d) : undefined
          const load = cfg?.bw ? { bw: true, ...(bwKg !== undefined ? { bwKg } : {}) } : {}
          return cfg?.side ? { exId, ...load, unilateral: true, sets: toUnilateral(sets) } : { exId, ...load, sets }
        })(),
      ],
    })),

  swapExercise: (entry, exId, side = false, bw = false) =>
    set((s) => {
      const e = s.active?.entries[entry]
      if (!s.active || !e || e.exId === exId) return {}
      const swapped = swapEntry(e, exId, side, s.workouts, { bw, bwKg: bw ? bodyweightOn(s.bodyweight, s.active.d) : undefined })
      if (!swapped) return {}
      return { active: { ...s.active, entries: s.active.entries.map((x, i) => (i === entry ? swapped : x)) } }
    }),

  finishWorkout: () => {
    const { active } = get()
    if (!active) return null
    // Tamamlanan setler (ve tek tarafı yapılmış yarım setler) kaydedilir; yalnız ısınması yapılmış egzersiz kayda girmez.
    const mapped = active.entries.map((e) => {
      const { note: _raw, ...rest } = e
      const note = cleanNote(e.note)
      return { ...rest, sets: e.sets.flatMap((x) => finalizeSet(x) ?? []), ...(note ? { note } : {}) }
    })
    // Hiç set yapılmadıysa antrenman kaydedilmez (yalnız not da yetmez). Antrenman kaydedilirken,
    // setsiz kalan ama notu olan egzersiz de tutulur: "ağrı yüzünden yapmadım" bilgisi değerlidir.
    if (!mapped.some((e) => e.sets.some((x) => !x.warmup))) {
      set(() => ({ active: null }))
      return null
    }
    const entries = mapped.filter((e) => e.sets.some((x) => !x.warmup) || e.note)
    const { note: _rawNote, ...base } = active
    const note = cleanNote(active.note)
    const finished: Workout = { ...base, entries, end: Date.now(), d: active.d || dayString(), ...(note ? { note } : {}) }
    set((s) => ({ workouts: [...s.workouts, finished], active: null }))
    return finished
  },

  discardWorkout: () => set(() => ({ active: null })),

  deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

  addWorkout: (workout) => set((s) => ({ workouts: insertWorkout(s.workouts, workout) })),

  updateWorkout: (updated) =>
    set((s) => ({ workouts: s.workouts.map((w) => (w.id === updated.id ? updated : w)) })),

  importWorkouts: (incoming, customEx) =>
    set((s) => {
      // Aynı başlangıç + ad zaten varsa eklenmez; liste eskiden yeniye sıralı kalır (bkz. lastEntryFor).
      const have = new Set(s.workouts.map((w) => `${w.start}|${w.name}`))
      const fresh = incoming.filter((w) => !have.has(`${w.start}|${w.name}`))
      const ids = new Set(s.customEx.map((c) => c.id))
      return {
        workouts: [...s.workouts, ...fresh].sort((a, b) => a.d.localeCompare(b.d) || a.start - b.start),
        customEx: [...s.customEx, ...customEx.filter((c) => !ids.has(c.id))],
      }
    }),

  addRoutinesFrom: (incoming) => {
    const merged = mergeRoutines(get(), incoming)
    if (merged.added > 0) set(() => ({ routines: merged.routines, customEx: merged.customEx }))
    return merged
  },

  logBodyweight: (entry) =>
    set((s) => ({
      bodyweight: [...s.bodyweight.filter((b) => b.d !== entry.d), entry].sort((a, b) =>
        a.d.localeCompare(b.d),
      ),
    })),

  addCustomExercise: (ex) => {
    const id = `custom-${newId()}`
    set((s) => ({ customEx: [...s.customEx, { ...ex, id }] }))
    return id
  },

  setMuscleFix: (exId, raw) =>
    set((s) => {
      const fix = normalizeMuscleFix(raw)
      return fix ? { muscleFix: { ...s.muscleFix, [exId]: fix } } : {}
    }),

  clearMuscleFix: (exId) =>
    set((s) => {
      if (!Object.hasOwn(s.muscleFix, exId)) return {}
      return { muscleFix: Object.fromEntries(Object.entries(s.muscleFix).filter(([id]) => id !== exId)) }
    }),

  replaceAll: (state) => set(() => ({ ...state })),

  markBackedUp: (now) =>
    set((s) => ({
      settings: { ...s.settings, lastBackupAt: now, lastBackupHash: fingerprint(s), backupSnoozedUntil: undefined },
    })),

  snoozeBackup: (now) =>
    set((s) => ({ settings: { ...s.settings, backupSnoozedUntil: now + SNOOZE_DAYS * 24 * 60 * 60 * 1000 } })),
}))

/** Yalnızca veri alanlarını (eylemler hariç) seçer. */
export function snapshot(s: Store): State {
  return {
    version: s.version,
    settings: s.settings,
    routines: s.routines,
    week: s.week,
    workouts: s.workouts,
    active: s.active,
    bodyweight: s.bodyweight,
    customEx: s.customEx,
    muscleFix: s.muscleFix,
  }
}

useStore.subscribe((s) => save(snapshot(s)))
