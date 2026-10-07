import type { Unit } from '../lib/units.ts'

export const SCHEMA_VERSION = 1

export type ProgressionMode = 'off' | 'linear' | 'double'

/** Rutindeki bir egzersizin planı. Ağırlıklar kg cinsindendir. */
export interface ExCfg {
  exId: string
  sets: number
  reps: number
  weight: number
  prog: ProgressionMode
  /** Tek taraflı egzersiz: sol ve sağ taraf ayrı kaydedilir, ağırlık taraf başınadır. */
  side?: boolean
  /** Her başarılı seansta eklenecek kg. */
  inc: number
  /** Double progression için tekrar aralığının üst sınırı. */
  repsMax: number
  restSec?: number
}

export interface Routine {
  id: string
  name: string
  ex: ExCfg[]
}

/** Tek taraflı setin bir tarafı. */
export interface SideSet {
  r: number
  done: boolean
}

export interface SetEntry {
  w: number
  /** Tekrar. Tek taraflı sette taraf başına tekrardır: iki tarafın düşüğü (zayıf taraf belirler). */
  r: number
  rir?: number
  /** Tek taraflı sette iki taraf da tamamlanmışsa true. */
  done: boolean
  warmup?: boolean
  /** Tek taraflı setlerde gerçek kaynak; `r` ve `done` buradan türetilir (bkz. lib/sets.ts). */
  sides?: { L: SideSet; R: SideSet }
}

export interface WorkoutEntry {
  exId: string
  sets: SetEntry[]
  /** Setler sol/sağ ayrı tutulur. */
  unilateral?: boolean
}

export interface Workout {
  id: string
  /** YYYY-MM-DD, yerel gün. */
  d: string
  start: number
  end?: number
  routineId?: string
  name: string
  entries: WorkoutEntry[]
  note?: string
}

export interface BodyweightEntry {
  d: string
  w: number
}

export interface CustomExercise {
  id: string
  name: string
  primaryMuscles: string[]
  equipment: string
}

export interface Settings {
  unit: Unit
  restSec: number
  /** 0 = Pazar … 6 = Cumartesi, Date.getDay() ile uyumlu. */
  weekStart: number
}

export interface State {
  version: number
  settings: Settings
  routines: Routine[]
  /** Haftanın günü (0-6) → rutin kimliği. */
  week: Record<number, string>
  workouts: Workout[]
  active: Workout | null
  bodyweight: BodyweightEntry[]
  customEx: CustomExercise[]
}

export function defaultState(): State {
  return {
    version: SCHEMA_VERSION,
    settings: { unit: 'kg', restSec: 90, weekStart: 1 },
    routines: [],
    week: {},
    workouts: [],
    active: null,
    bodyweight: [],
    customEx: [],
  }
}
