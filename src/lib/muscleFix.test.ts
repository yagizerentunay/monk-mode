import { describe, expect, it } from 'vitest'
import { applyMuscleFix, normalizeMuscleFix, sameMuscleFix } from './muscleFix.ts'

describe('normalizeMuscleFix', () => {
  it('geçerli kasları MUSCLES sırasına dizer ve tekilleştirir', () => {
    expect(normalizeMuscleFix({ primary: ['triceps', 'chest', 'chest'], secondary: ['shoulders'] })).toEqual({
      primary: ['chest', 'triceps'],
      secondary: ['shoulders'],
    })
  })

  it('bilinmeyen ve metin olmayan kasları atar', () => {
    expect(normalizeMuscleFix({ primary: ['chest', 'foo', 7, null], secondary: ['bar'] })).toEqual({
      primary: ['chest'],
      secondary: [],
    })
  })

  it('birincil olan kası ikincil listeden çıkarır', () => {
    expect(normalizeMuscleFix({ primary: ['adductors'], secondary: ['adductors', 'glutes'] })).toEqual({
      primary: ['adductors'],
      secondary: ['glutes'],
    })
  })

  it('geçerli birincil kas yoksa undefined döner', () => {
    expect(normalizeMuscleFix({ primary: [], secondary: ['chest'] })).toBeUndefined()
    expect(normalizeMuscleFix({ primary: ['foo'] })).toBeUndefined()
    expect(normalizeMuscleFix({})).toBeUndefined()
    expect(normalizeMuscleFix({ primary: 'chest' })).toBeUndefined()
  })
})

describe('applyMuscleFix', () => {
  const ex = { id: 'x', primaryMuscles: ['quadriceps'], secondaryMuscles: [] as string[] }

  it('düzeltme yoksa aynı nesneyi döndürür', () => {
    expect(applyMuscleFix(ex, undefined)).toBe(ex)
  })

  it('kasları değiştirir ve eski değerleri original içinde saklar', () => {
    const out = applyMuscleFix(ex, { primary: ['adductors'], secondary: ['quadriceps'] })
    expect(out.primaryMuscles).toEqual(['adductors'])
    expect(out.secondaryMuscles).toEqual(['quadriceps'])
    expect(out.original).toEqual({ primary: ['quadriceps'], secondary: [] })
    expect(out.id).toBe('x')
  })

  it('girdi nesnesini değiştirmez', () => {
    applyMuscleFix(ex, { primary: ['adductors'], secondary: [] })
    expect(ex.primaryMuscles).toEqual(['quadriceps'])
  })
})

describe('sameMuscleFix', () => {
  it('sıra duyarlı eşitlik (normalize edilmiş girdilerde)', () => {
    expect(sameMuscleFix({ primary: ['chest'], secondary: [] }, { primary: ['chest'], secondary: [] })).toBe(true)
    expect(sameMuscleFix({ primary: ['chest'], secondary: [] }, { primary: ['chest'], secondary: ['triceps'] })).toBe(false)
    expect(sameMuscleFix({ primary: ['chest'], secondary: [] }, { primary: ['triceps'], secondary: [] })).toBe(false)
  })
})
