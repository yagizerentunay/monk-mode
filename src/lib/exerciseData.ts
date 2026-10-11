/**
 * free-exercise-db ham kaydından uygulamanın yüklediği iki dosyayı üretir (bkz. scripts/build-exercise-data.ts):
 * - `exercises.json`: liste, arama ve öneriler için gereken alanlar. Kullanılmayan `force`/`mechanic` atılır.
 * - `instructions.json`: egzersiz kimliği → talimat adımları. Verinin çoğu bu; yalnız detay açılınca yüklenir.
 */
export interface RawExercise {
  id: string
  name: string
  level: string
  equipment: string | null
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
}

export function slimExercises(raw: RawExercise[]): string {
  return JSON.stringify(
    raw.map(({ id, name, level, equipment, category, primaryMuscles, secondaryMuscles, images }) => ({
      id,
      name,
      level,
      equipment,
      category,
      primaryMuscles,
      secondaryMuscles,
      images,
    })),
  )
}

export function instructionsById(raw: RawExercise[]): string {
  return JSON.stringify(Object.fromEntries(raw.filter((e) => e.instructions.length > 0).map((e) => [e.id, e.instructions])))
}
