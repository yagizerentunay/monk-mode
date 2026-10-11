import { describe, expect, it } from 'vitest'
import source from '../../data/free-exercise-db/exercises.json?raw'
import instructionsFile from '../../public/data/instructions.json?raw'
import exercisesFile from '../../public/data/exercises.json?raw'
import { instructionsById, slimExercises, type RawExercise } from './exerciseData.ts'

const raw = JSON.parse(source) as RawExercise[]

describe('üretilmiş egzersiz verisi', () => {
  it('public/data dosyaları kaynakla güncel (değilse: npm run data:exercises)', () => {
    expect(exercisesFile).toBe(slimExercises(raw) + '\n')
    expect(instructionsFile).toBe(instructionsById(raw) + '\n')
  })

  it('her egzersiz listede, talimatı olan her egzersiz talimat dosyasında', () => {
    const list = JSON.parse(slimExercises(raw)) as { id: string }[]
    const steps = JSON.parse(instructionsById(raw)) as Record<string, string[]>
    expect(list.map((e) => e.id)).toEqual(raw.map((e) => e.id))
    expect(list.some((e) => 'force' in e || 'mechanic' in e || 'instructions' in e)).toBe(false)
    for (const e of raw) expect(steps[e.id] ?? []).toEqual(e.instructions)
  })
})
