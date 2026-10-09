import { describe, expect, it } from 'vitest'
import { muscleSets } from './muscles.ts'
import { alternativesFor } from './swap.ts'
import {
  facetValues,
  filterExercises,
  fromCustom,
  isBodyOnly,
  isUnilateralName,
  nameLang,
  withMuscleFixes,
  type Exercise,
} from './exercises.ts'

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

  it('Türkçe kas ve ekipman adıyla da arar, aksan ve büyük harf farkını yok sayar', () => {
    const ids = (query: string) => filterExercises(list, { query, muscle: null, equipment: null }).map((e) => e.id)
    expect(ids('biseps')).toEqual(['b', 'c'])
    expect(ids('BİSEPS')).toEqual(['b', 'c'])
    expect(ids('on bacak')).toEqual(['a'])
    expect(ids('Ön Bacak')).toEqual(['a'])
    expect(ids('dumbbell')).toEqual(['b'])
    expect(ids('kablo')).toEqual([])
  })

  it('İngilizce adlarda I harfi noktalı/noktasız fark etmez', () => {
    expect(filterExercises(list, { query: 'BARBELL SQUAT', muscle: null, equipment: null }).map((e) => e.id)).toEqual(['a'])
    expect(filterExercises(list, { query: 'dumbbell curl', muscle: null, equipment: null }).map((e) => e.id)).toEqual(['b'])
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

  it('ekipmanı "body only" olan (özel egzersiz dahil) egzersizi vücut ağırlığı sayar', () => {
    expect(isBodyOnly({ equipment: 'body only' })).toBe(true)
    expect(isBodyOnly({ equipment: 'barbell' })).toBe(false)
    expect(isBodyOnly({ equipment: null })).toBe(false)
    expect(isBodyOnly(fromCustom({ id: 'x', name: 'Dips', primaryMuscles: [], equipment: 'body only' }))).toBe(true)
    expect(isBodyOnly(fromCustom({ id: 'y', name: 'Sled', primaryMuscles: [], equipment: '' }))).toBe(false)
  })

  it('özel egzersizi kütüphane biçimine çevirir', () => {
    const e = fromCustom({ id: 'x', name: 'Sled Push', primaryMuscles: ['quadriceps'], equipment: '' })
    expect(e).toMatchObject({ id: 'x', custom: true, equipment: null })
  })
})

describe('withMuscleFixes', () => {
  const hip = ex('hip', 'Cable Hip Adduction', 'quadriceps', 'cable')
  const fixes = { hip: { primary: ['adductors'], secondary: [] as string[] } }

  it('düzeltilen egzersizin kaslarını değiştirir, eskisini original içinde saklar; diğerlerine dokunmaz', () => {
    const out = withMuscleFixes([hip, list[0]], fixes)
    expect(out[0].primaryMuscles).toEqual(['adductors'])
    expect(out[0].original).toEqual({ primary: ['quadriceps'], secondary: [] })
    expect(out[1]).toBe(list[0])
  })

  it('düzeltme yoksa listedeki nesneler aynen döner', () => {
    const out = withMuscleFixes(list, {})
    expect(out.every((e, i) => e === list[i])).toBe(true)
  })

  it('prototip anahtarlarını düzeltme sanmaz', () => {
    const odd = ex('constructor', 'Odd', 'chest', null)
    expect(withMuscleFixes([odd], {})[0]).toBe(odd)
  })

  it('özel egzersizlere de uygulanır', () => {
    const custom = fromCustom({ id: 'custom-1', name: 'Mekik', primaryMuscles: ['abdominals'], equipment: '' })
    const out = withMuscleFixes([custom], { 'custom-1': { primary: ['lower back'], secondary: ['abdominals'] } })
    expect(out[0].primaryMuscles).toEqual(['lower back'])
    expect(out[0].custom).toBe(true)
  })

  it('kas filtresi düzeltilmiş kasa göre çalışır', () => {
    const out = withMuscleFixes([hip, list[0]], fixes)
    expect(filterExercises(out, { query: '', muscle: 'adductors', equipment: '' }).map((e) => e.id)).toEqual(['hip'])
    expect(filterExercises(out, { query: '', muscle: 'quadriceps', equipment: '' }).map((e) => e.id)).toEqual(['a'])
  })

  it('kas ve değiştirme önerisi düzeltilmiş kası kullanır', () => {
    const adductor = ex('add', 'Adductor', 'adductors', 'machine')
    const out = withMuscleFixes([hip, adductor, list[0]], fixes)
    expect(alternativesFor(out[0], out, new Set()).map((e) => e.id)).toEqual(['add'])
  })

  it('kas haritası düzeltilmiş kasa set yazar', () => {
    const workout = {
      id: 'w',
      d: '2026-10-06',
      start: 0,
      name: 'B',
      entries: [{ exId: 'hip', sets: [{ w: 45, r: 8, done: true }, { w: 45, r: 8, done: true }] }],
    }
    const before = muscleSets([workout], new Map([[hip.id, hip]]), { from: '2026-10-05' })
    const fixed = withMuscleFixes([hip], fixes)
    const after = muscleSets([workout], new Map(fixed.map((e) => [e.id, e])), { from: '2026-10-05' })
    expect(before.quadriceps).toBe(2)
    expect(before.adductors).toBe(0)
    expect(after.quadriceps).toBe(0)
    expect(after.adductors).toBe(2)
  })
})
