import { create } from 'zustand'
import { deriveSet, toBilateral, toUnilateral, type Side } from '../lib/sets.ts'
import { buildWorkout, dayString, newId } from '../lib/workout.ts'
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
  addSet(entry: number): void
  removeSet(entry: number, set: number): void
  addExerciseToActive(exId: string, cfg?: Partial<ExCfg>): void
  finishWorkout(): Workout | null
  discardWorkout(): void
  deleteWorkout(id: string): void
  logBodyweight(entry: BodyweightEntry): void
  addCustomExercise(ex: Omit<CustomExercise, 'id'>): string
  replaceAll(state: State): void
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
    set(() => ({ active: buildWorkout(routine, s.workouts, Date.now()) }))
  },

  updateSet: (entry, setIdx, patch) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) =>
        i !== entry
          ? e
          : { ...e, sets: e.sets.map((x, j) => (j === setIdx ? deriveSet({ ...x, ...patch }) : x)) },
      ),
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

  addSet: (entry) =>
    withActive(set, (w) => ({
      ...w,
      entries: w.entries.map((e, i) => {
        if (i !== entry) return e
        const last = e.sets[e.sets.length - 1]
        const base: SetEntry = { w: last?.w ?? 0, r: last?.r ?? 0, done: false }
        // Yeni set, son setin tekrar hedeflerini her iki tarafa da taşır; tamamlanma sıfırlanır.
        const next: SetEntry = last?.sides
          ? deriveSet({ ...base, sides: { L: { r: last.sides.L.r, done: false }, R: { r: last.sides.R.r, done: false } } })
          : base
        return { ...e, sets: [...e.sets, next] }
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
          return cfg?.side ? { exId, unilateral: true, sets: toUnilateral(sets) } : { exId, sets }
        })(),
      ],
    })),

  finishWorkout: () => {
    const { active } = get()
    if (!active) return null
    // Hiç set tamamlanmadıysa kayıt oluşturma.
    const entries = active.entries
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done || x.warmup) }))
      .filter((e) => e.sets.some((x) => x.done))
    if (entries.length === 0) {
      set(() => ({ active: null }))
      return null
    }
    const finished: Workout = { ...active, entries, end: Date.now(), d: active.d || dayString() }
    set((s) => ({ workouts: [...s.workouts, finished], active: null }))
    return finished
  },

  discardWorkout: () => set(() => ({ active: null })),

  deleteWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

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

  replaceAll: (state) => set(() => ({ ...state })),
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
  }
}

useStore.subscribe((s) => save(snapshot(s)))
