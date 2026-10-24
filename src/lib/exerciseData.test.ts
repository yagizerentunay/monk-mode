import { describe, expect, it } from 'vitest'
import exercisesFile from '../../public/data/exercises.json?raw'
import legacyFile from '../../public/data/legacy-exercises.json?raw'
import { libraryProblems, type LegacyRecord, type LibraryRecord } from './exerciseData.ts'
import { MUSCLES } from './muscles.ts'

// Takip edilen 17 kas grubunda olmayan ama yardımcı kas olarak geçen kaslar (bkz. labels.ts).
const EXTRA_MUSCLES = new Set(['hip flexors', 'obliques'])
const library = JSON.parse(exercisesFile) as LibraryRecord[]
const legacy = JSON.parse(legacyFile) as LegacyRecord[]
// Vite, public/ altındaki dosyaları import.meta.glob ile adlandırır; node tipleri (fs) bu projede yok.
const images = new Set(Object.keys(import.meta.glob('../../public/exercises/*.{webp,png}')).map((p) => p.replace('../../public/', '')))

describe('egzersiz kütüphanesi (public/data/exercises.json, Atlas verisinden üretilir)', () => {
  it('biçim hatası yok: benzersiz kimlik ve ad, yönerge, geçerli görsel yolu', () => {
    expect(libraryProblems(library)).toEqual([])
  })

  it('her kaydın en az bir yönerge satırı var, satırlar boş değil', () => {
    for (const e of library) {
      expect(e.instructions.length, e.id).toBeGreaterThan(0)
      expect(e.instructions.every((line) => typeof line === 'string' && line.trim() !== ''), e.id).toBe(true)
      if (e.instructionsEn) expect(e.instructionsEn.every((line) => typeof line === 'string' && line.trim() !== ''), e.id).toBe(true)
    }
  })

  it('görseli olan her kaydın dosyası public/exercises altında var (görselsiz kayıt geçerlidir)', () => {
    const withPicture = library.filter((e) => e.illustration !== undefined)
    expect(withPicture.filter((e) => !images.has(e.illustration!)).map((e) => e.id)).toEqual([])
  })

  it('public/exercises altında hiçbir kayıtça kullanılmayan görsel dosyası yok', () => {
    const used = new Set(library.map((e) => e.illustration).filter((p) => p !== undefined))
    expect([...images].filter((p) => !used.has(p))).toEqual([])
  })

  it('her kas bilinen bir kas, her kas grubunda en az bir egzersiz var', () => {
    const known = new Set<string>(MUSCLES)
    const used = new Set(library.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))
    expect([...used].filter((m) => !known.has(m) && !EXTRA_MUSCLES.has(m))).toEqual([])
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

  it('doğrulayıcı görselsiz kaydı kabul eder, geçersiz görsel yolunu ve boş yönerge satırını yakalar', () => {
    const base: LibraryRecord = { ...library[0], id: 'atlas:x', name: 'X', aliases: undefined, illustration: undefined }
    expect(libraryProblems([base])).toEqual([])
    expect(libraryProblems([{ ...base, illustration: 'exercises/x.png' }])).toEqual([])
    expect(libraryProblems([{ ...base, illustration: 'exercises/X.gif' }])).toEqual(['atlas:x: görsel yolu geçersiz (exercises/X.gif)'])
    expect(libraryProblems([{ ...base, instructions: ['ok', ' '] }])).toEqual(['atlas:x: boş yönerge satırı'])
    expect(libraryProblems([{ ...base, instructionsEn: ['ok', ''] }])).toEqual(['atlas:x: boş İngilizce yönerge'])
    expect(libraryProblems([{ ...base, instructionsEn: [] }])).toEqual(['atlas:x: boş İngilizce yönerge'])
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
