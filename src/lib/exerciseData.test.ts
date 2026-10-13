import { describe, expect, it } from 'vitest'
import exercisesFile from '../../public/data/exercises.json?raw'
import legacyFile from '../../public/data/legacy-exercises.json?raw'
import { libraryProblems, type LegacyRecord, type LibraryRecord } from './exerciseData.ts'
import { MUSCLES } from './muscles.ts'

const library = JSON.parse(exercisesFile) as LibraryRecord[]
const legacy = JSON.parse(legacyFile) as LegacyRecord[]
// Vite, public/ altındaki dosyaları import.meta.glob ile adlandırır; node tipleri (fs) bu projede yok.
const images = new Set(Object.keys(import.meta.glob('../../public/exercises/*.webp')).map((p) => p.replace('../../public/', '')))

describe('egzersiz kütüphanesi (public/data/exercises.json)', () => {
  it('biçim hatası yok: benzersiz kimlik ve ad, yönerge, geçerli görsel yolu', () => {
    expect(libraryProblems(library)).toEqual([])
  })

  it('her görsel dosyası public/exercises altında var', () => {
    expect(library.filter((e) => !images.has(e.illustration)).map((e) => e.id)).toEqual([])
  })

  it('her kas bilinen bir kas, her kas grubunda en az bir egzersiz var', () => {
    const known = new Set<string>(MUSCLES)
    const used = new Set(library.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))
    expect([...used].filter((m) => !known.has(m) && m !== 'hip flexors')).toEqual([])
    const primary = new Set(library.flatMap((e) => e.primaryMuscles))
    expect([...MUSCLES].filter((m) => !primary.has(m))).toEqual([])
  })

  it('geçerli kütüphane hatalı kaydı yakalar (doğrulayıcı gerçekten çalışıyor)', () => {
    const bad = { ...library[0], id: library[1].id, instructions: [] }
    expect(libraryProblems([library[1], bad])).toEqual([
      `${bad.id}: kimlik tekrarı`,
      `${bad.id}: yönerge yok`,
    ])
  })
})

describe('eski kimlik tablosu (public/data/legacy-exercises.json)', () => {
  it('kütüphaneyle kesişmez ve kimlikler benzersiz', () => {
    const lib = new Set(library.map((e) => e.id))
    expect(legacy.filter((e) => lib.has(e.id)).map((e) => e.id)).toEqual([])
    expect(new Set(legacy.map((e) => e.id)).size).toBe(legacy.length)
  })

  it('yalnız ad, kas ve ekipman taşır (görsel ve talimat yok)', () => {
    for (const e of legacy) {
      expect(Object.keys(e).sort(), e.id).toEqual(['equipment', 'id', 'name', 'primaryMuscles', 'secondaryMuscles'])
    }
  })
})
