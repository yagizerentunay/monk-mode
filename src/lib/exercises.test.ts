import { describe, expect, it } from 'vitest'
import { facetValues, filterExercises, fromCustom, type Exercise } from './exercises.ts'

const ex = (id: string, name: string, muscle: string, equipment: string | null): Exercise => ({
  id,
  name,
  level: 'beginner',
  equipment,
  category: 'strength',
  primaryMuscles: [muscle],
  secondaryMuscles: [],
  instructions: [],
  images: [],
})

const list = [
  ex('a', 'Barbell Squat', 'quadriceps', 'barbell'),
  ex('b', 'Dumbbell Curl', 'biceps', 'dumbbell'),
  ex('c', 'Barbell Curl', 'biceps', 'barbell'),
]

describe('egzersiz filtreleri', () => {
  it('ada göre büyük/küçük harf duyarsız arar', () => {
    expect(filterExercises(list, { query: 'curl', muscle: null, equipment: null }).map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('kas ve ekipmanı birlikte uygular', () => {
    expect(filterExercises(list, { query: '', muscle: 'biceps', equipment: 'barbell' }).map((e) => e.id)).toEqual(['c'])
  })

  it('filtre boşken tümünü döndürür', () => {
    expect(filterExercises(list, { query: '  ', muscle: null, equipment: null })).toHaveLength(3)
  })

  it('değerleri sıklığa göre sıralar', () => {
    expect(facetValues(list, (e) => e.primaryMuscles)).toEqual(['biceps', 'quadriceps'])
  })

  it('özel egzersizi kütüphane biçimine çevirir', () => {
    const e = fromCustom({ id: 'x', name: 'Sled Push', primaryMuscles: ['quadriceps'], equipment: '' })
    expect(e).toMatchObject({ id: 'x', custom: true, equipment: null })
  })
})
