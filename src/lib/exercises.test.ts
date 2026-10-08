import { describe, expect, it } from 'vitest'
import { facetValues, filterExercises, fromCustom, isUnilateralName, nameLang, type Exercise } from './exercises.ts'

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

describe('nameLang', () => {
  it('kütüphane adlarını İngilizce, özel ve bilinmeyen adları sayfa dilinde bırakır', () => {
    expect(nameLang(list[0])).toBe('en')
    expect(nameLang(fromCustom({ id: 'c1', name: 'Mekik', primaryMuscles: ['abdominals'], equipment: '' }))).toBeUndefined()
    expect(nameLang(undefined)).toBeUndefined()
  })
})

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

  it('adından tek taraflı egzersizleri önerir', () => {
    for (const n of ['One-Arm Dumbbell Row', 'Dumbbell Lunges', 'Barbell Step Ups', 'Single-Leg Press', 'Kettlebell Pistol Squat', 'Glute Kickback', 'Concentration Curls', 'Bulgarian Split Squat']) {
      expect(isUnilateralName(n), n).toBe(true)
    }
  })

  it('çift taraflı veya dönüşümlü egzersizleri önermez', () => {
    for (const n of ['Barbell Bench Press - Medium Grip', 'Alternate Hammer Curl', 'Alternating Kettlebell Row', 'Cable Reverse Crunch', 'Chest Push (single response)', 'Barbell Squat']) {
      expect(isUnilateralName(n), n).toBe(false)
    }
  })

  it('özel egzersizi kütüphane biçimine çevirir', () => {
    const e = fromCustom({ id: 'x', name: 'Sled Push', primaryMuscles: ['quadriceps'], equipment: '' })
    expect(e).toMatchObject({ id: 'x', custom: true, equipment: null })
  })
})
