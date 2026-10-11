// Kaynak veriden public/data dosyalarını yeniden üretir: `npm run data:exercises`.
// Kaynak güncellenince çalıştır; src/lib/exerciseData.test.ts çıktıların güncel olduğunu denetler.
import { readFileSync, writeFileSync } from 'node:fs'
import { instructionsById, slimExercises, type RawExercise } from '../src/lib/exerciseData.ts'

const raw = JSON.parse(readFileSync('data/free-exercise-db/exercises.json', 'utf8')) as RawExercise[]
writeFileSync('public/data/exercises.json', slimExercises(raw) + '\n')
writeFileSync('public/data/instructions.json', instructionsById(raw) + '\n')
console.log(`${raw.length} egzersiz yazıldı.`)
