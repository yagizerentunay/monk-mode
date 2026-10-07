import type { CustomExercise } from '../store/schema.ts'

/** free-exercise-db kaydı (kullandığımız alanlar). */
export interface Exercise {
  id: string
  name: string
  level: string
  equipment: string | null
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
  custom?: boolean
}

const IMAGE_CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

export function imageUrl(path: string): string {
  return IMAGE_CDN + path
}

let cache: Promise<Exercise[]> | null = null

/** Egzersiz kütüphanesini bir kez yükler. */
export function loadExercises(): Promise<Exercise[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Egzersiz verisi yüklenemedi (${r.status})`)
      return r.json() as Promise<Exercise[]>
    })
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
}

export function fromCustom(c: CustomExercise): Exercise {
  return {
    id: c.id,
    name: c.name,
    level: 'beginner',
    equipment: c.equipment || null,
    category: 'strength',
    primaryMuscles: c.primaryMuscles,
    secondaryMuscles: [],
    instructions: [],
    images: [],
    custom: true,
  }
}

export interface ExerciseFilter {
  query: string
  muscle: string | null
  equipment: string | null
}

export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const q = f.query.trim().toLowerCase()
  return list.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!f.muscle || e.primaryMuscles.includes(f.muscle)) &&
      (!f.equipment || e.equipment === f.equipment),
  )
}

/** Listedeki benzersiz değerler, sık kullanılandan seyreğe. */
export function facetValues(list: Exercise[], pick: (e: Exercise) => string[]): string[] {
  const counts = new Map<string, number>()
  for (const e of list) for (const v of pick(e)) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}
