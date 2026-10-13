import { describe, expect, it } from 'vitest'
import { atlasToCatalog, type AtlasExercise } from './atlasAdapter.ts'
import { libraryProblems, type LegacyRecord } from './exerciseData.ts'

function atlas(overrides: Partial<AtlasExercise> & { id: string }): AtlasExercise {
  return {
    name: { en: 'Fixture Move' },
    difficulty: 'beginner',
    category: 'strength',
    equipment: ['bodyweight'],
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: { en: ['Do it.'] },
    ...overrides,
  }
}

const legacy = (id: string, name = id): LegacyRecord => ({ id, name, equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [] })

describe('atlasToCatalog: kayıt alanları', () => {
  it('Monk kimliği legacyIds[0], yoksa atlas:<id>', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'archer-push-up', name: { en: 'Archer Push-Up' }, legacyIds: ['monk-chest-archer-push-up'] }),
        atlas({ id: 'plank', name: { en: 'Plank' } }),
      ],
      [],
    )
    expect(library.map((e) => e.id)).toEqual(['monk-chest-archer-push-up', 'atlas:plank'])
  })

  it('ad name.en, diğer adlar aynen geçer; boş aliases alanı yazılmaz', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'Alpha', tr: 'Alfa' }, aliases: ['Alpha Move', 'A-Move'] }),
        atlas({ id: 'b', name: { en: 'Beta' }, aliases: [] }),
        atlas({ id: 'c', name: { en: 'Gamma' } }),
      ],
      [],
    )
    expect(library[0]).toMatchObject({ name: 'Alpha', aliases: ['Alpha Move', 'A-Move'] })
    expect('aliases' in library[1]).toBe(false)
    expect('aliases' in library[2]).toBe(false)
  })

  it('yönergeler: Türkçe varsa Türkçe, yoksa ya da boşsa İngilizce', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'A' }, instructions: { en: ['Step one.'], tr: ['Birinci adım.', 'İkinci adım.'] } }),
        atlas({ id: 'b', name: { en: 'B' }, instructions: { en: ['Only English.'] } }),
        atlas({ id: 'c', name: { en: 'C' }, instructions: { en: ['Empty tr falls back.'], tr: [] } }),
      ],
      [],
    )
    expect(library.map((e) => e.instructions)).toEqual([['Birinci adım.', 'İkinci adım.'], ['Only English.'], ['Empty tr falls back.']])
  })

  it('seviye ve kategori eşlemesi', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'A' }, difficulty: 'beginner', category: 'strength' }),
        atlas({ id: 'b', name: { en: 'B' }, difficulty: 'intermediate', category: 'mobility' }),
        atlas({ id: 'c', name: { en: 'C' }, difficulty: 'advanced', category: 'cardio' }),
      ],
      [],
    )
    expect(library.map((e) => [e.level, e.category])).toEqual([
      ['beginner', 'strength'],
      ['intermediate', 'stretching'],
      ['expert', 'cardio'],
    ])
  })

  it('kas ters eşlemesi: upper-back, lower-back, hip-flexors dışında aynı ad', () => {
    const { library } = atlasToCatalog(
      [
        atlas({
          id: 'a',
          name: { en: 'A' },
          primaryMuscles: ['upper-back', 'lower-back', 'neck'],
          secondaryMuscles: ['hip-flexors', 'obliques', 'quadriceps', 'abductors'],
        }),
      ],
      [],
    )
    expect(library[0].primaryMuscles).toEqual(['middle back', 'lower back', 'neck'])
    expect(library[0].secondaryMuscles).toEqual(['hip flexors', 'obliques', 'quadriceps', 'abductors'])
  })

  it('ekipman ters eşlemesi: tek kod, boş liste null', () => {
    const cases: [string[], string | null][] = [
      [['bodyweight'], 'body only'],
      [['barbell'], 'barbell'],
      [['dumbbell'], 'dumbbell'],
      [['cable'], 'cable'],
      [['machine'], 'machine'],
      [['band'], 'bands'],
      [['kettlebell'], 'kettlebells'],
      [['ez-bar'], 'e-z curl bar'],
      [['exercise-ball'], 'exercise ball'],
      [['other'], 'other'],
      [[], null],
    ]
    const { library } = atlasToCatalog(
      cases.map(([equipment], i) => atlas({ id: `x${i}`, name: { en: `Move ${String(i).padStart(2, '0')}` }, equipment })),
      [],
    )
    expect(library.map((e) => e.equipment)).toEqual(cases.map(([, want]) => want))
  })

  it('ekipman: tesis kodları (bench, mat, pull-up-bar) atlanır, ilk diğer kod seçilir', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'A' }, equipment: ['bench', 'dumbbell'] }),
        atlas({ id: 'b', name: { en: 'B' }, equipment: ['barbell', 'bench'] }),
        atlas({ id: 'c', name: { en: 'C' }, equipment: ['mat', 'bodyweight'] }),
        atlas({ id: 'd', name: { en: 'D' }, equipment: ['pull-up-bar'] }),
      ],
      [],
    )
    expect(library.map((e) => e.equipment)).toEqual(['dumbbell', 'barbell', 'body only', null])
  })
})

describe('atlasToCatalog: görsel', () => {
  const media = (role: string, file: string) => ({ path: `media/exercises/${file}`, role })

  it('reference > finish > start; yol exercises/<dosya adı> olur', () => {
    const { library, media: copies } = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'A' }, media: [media('start', 'a-start.webp'), media('finish', 'a-finish.webp'), media('reference', 'a-ref.webp')] }),
        atlas({ id: 'b', name: { en: 'B' }, media: [media('start', 'b-start.webp'), media('finish', 'b-finish.png')] }),
        atlas({ id: 'c', name: { en: 'C' }, media: [media('animation', 'c.webp'), media('start', 'c-start.webp')] }),
      ],
      [],
    )
    expect(library.map((e) => e.illustration)).toEqual(['exercises/a-ref.webp', 'exercises/b-finish.png', 'exercises/c-start.webp'])
    expect(copies).toEqual([
      { from: 'media/exercises/a-ref.webp', to: 'exercises/a-ref.webp' },
      { from: 'media/exercises/b-finish.png', to: 'exercises/b-finish.png' },
      { from: 'media/exercises/c-start.webp', to: 'exercises/c-start.webp' },
    ])
  })

  it('görseli olmayan kayıtta illustration alanı yoktur ve kopya listelenmez', () => {
    const { library, media: copies } = atlasToCatalog(
      [atlas({ id: 'a', name: { en: 'A' } }), atlas({ id: 'b', name: { en: 'B' }, media: [media('animation', 'b.webp')] })],
      [],
    )
    expect(library.every((e) => !('illustration' in e))).toBe(true)
    expect(copies).toEqual([])
    expect(libraryProblems(library)).toEqual([])
  })

  it('görsel yolu eksikse ya da dosya adı geçersizse hata verir', () => {
    expect(() => atlasToCatalog([atlas({ id: 'a', media: [{ path: '', role: 'reference' }] })], [])).toThrow(/dosya yolu yok/)
    expect(() => atlasToCatalog([atlas({ id: 'a', media: [{ role: 'reference' } as never] })], [])).toThrow(/dosya yolu yok/)
    expect(() => atlasToCatalog([atlas({ id: 'a', media: [media('reference', 'Big Name.webp')] })], [])).toThrow(/dosya adı geçersiz/)
    expect(() => atlasToCatalog([atlas({ id: 'a', media: [media('reference', 'a.gif')] })], [])).toThrow(/dosya adı geçersiz/)
  })

  it('mediaFiles verilirse seçilen dosya orada yoksa hata verir', () => {
    const records = [atlas({ id: 'a', media: [media('reference', 'a.webp')] })]
    expect(atlasToCatalog(records, [], { mediaFiles: new Set(['media/exercises/a.webp']) }).library).toHaveLength(1)
    expect(() => atlasToCatalog(records, [], { mediaFiles: new Set() })).toThrow(/Atlas kaydı a: görsel dosyası bulunamadı/)
  })

  it('iki kayıt aynı dosyayı kullanabilir; farklı dosyalar aynı adı alamaz', () => {
    const same = atlasToCatalog(
      [
        atlas({ id: 'a', name: { en: 'A' }, media: [media('reference', 'shared.webp')] }),
        atlas({ id: 'b', name: { en: 'B' }, media: [media('reference', 'shared.webp')] }),
      ],
      [],
    )
    expect(same.media).toHaveLength(1)
    expect(() =>
      atlasToCatalog(
        [
          atlas({ id: 'a', name: { en: 'A' }, media: [{ path: 'media/one/x.webp', role: 'reference' }] }),
          atlas({ id: 'b', name: { en: 'B' }, media: [{ path: 'media/two/x.webp', role: 'reference' }] }),
        ],
        [],
      ),
    ).toThrow(/çakışıyor/)
  })
})

describe('atlasToCatalog: eski kimlik tablosu', () => {
  it('kütüphaneye geçen kimlikler tablodan düşer; diğerlerinin sırası aynı kalır', () => {
    const previous = [legacy('Zed'), legacy('Barbell_Curl'), legacy('Alpha'), legacy('monk-chest-archer-push-up')]
    const { legacy: next } = atlasToCatalog(
      [
        atlas({ id: 'barbell-curl', name: { en: 'Barbell Curl' }, legacyIds: ['Barbell_Curl'] }),
        atlas({ id: 'archer-push-up', name: { en: 'Archer Push-Up' }, legacyIds: ['monk-chest-archer-push-up'] }),
      ],
      previous,
    )
    expect(next.map((e) => e.id)).toEqual(['Zed', 'Alpha'])
  })

  it('fazladan legacyIds kaydın adı, kası ve ekipmanıyla eski tabloya girer', () => {
    const previous = [legacy('Old_One', 'Old Name'), legacy('Keep')]
    const { library, legacy: next } = atlasToCatalog(
      [
        atlas({
          id: 'front-squat',
          name: { en: 'Front Squat' },
          equipment: ['barbell'],
          primaryMuscles: ['quadriceps', 'upper-back'],
          secondaryMuscles: ['glutes'],
          legacyIds: ['monk-quadriceps-front-squat', 'Front_Barbell_Squat', 'Old_One'],
        }),
      ],
      previous,
    )
    expect(library.map((e) => e.id)).toEqual(['monk-quadriceps-front-squat'])
    const carried = { equipment: 'barbell', primaryMuscles: ['quadriceps', 'middle back'], secondaryMuscles: ['glutes'] }
    // Var olan eski kimlik yerinde yenilenir, yenisi sona eklenir; ilk kimlik tabloya girmez.
    expect(next).toEqual([
      { id: 'Old_One', name: 'Front Squat', ...carried },
      { id: 'Keep', name: 'Keep', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: [] },
      { id: 'Front_Barbell_Squat', name: 'Front Squat', ...carried },
    ])
  })

  it('yeni fazladan kimlikler kimliğe göre sıralı eklenir (girdi sırasından bağımsız)', () => {
    const records = [
      atlas({ id: 'a', name: { en: 'A' }, legacyIds: ['monk-a', 'z_alias'] }),
      atlas({ id: 'b', name: { en: 'B' }, legacyIds: ['monk-b', 'a_alias'] }),
    ]
    const forward = atlasToCatalog(records, []).legacy.map((e) => e.id)
    const backward = atlasToCatalog([...records].reverse(), []).legacy.map((e) => e.id)
    expect(forward).toEqual(['a_alias', 'z_alias'])
    expect(backward).toEqual(forward)
  })

  it('girdiyi değiştirmez ve ikinci çalıştırma aynı sonucu verir (idempotent)', () => {
    const records = [
      atlas({ id: 'a', name: { en: 'A' }, legacyIds: ['monk-a', 'old_a'], media: [{ path: 'media/exercises/a.webp', role: 'reference' }] }),
      atlas({ id: 'b', name: { en: 'B' } }),
    ]
    const previous = [legacy('monk-a'), legacy('keep')]
    const snapshot = JSON.stringify(previous)
    const first = atlasToCatalog(records, previous)
    expect(JSON.stringify(previous)).toBe(snapshot)
    const second = atlasToCatalog(records, first.legacy)
    expect(second).toEqual(first)
  })
})

describe('atlasToCatalog: sıralama', () => {
  it('kütüphane ada göre (büyük/küçük harfsiz, kod noktası sırasıyla) sıralanır', () => {
    const { library } = atlasToCatalog(
      [
        atlas({ id: 'z', name: { en: 'Zottman Curl' } }),
        atlas({ id: 'a', name: { en: 'Archer Push-Up' } }),
        atlas({ id: 'm', name: { en: 'machine Row' } }),
        atlas({ id: 'b', name: { en: '45-Degree Back Extension' } }),
      ],
      [],
    )
    expect(library.map((e) => e.name)).toEqual(['45-Degree Back Extension', 'Archer Push-Up', 'machine Row', 'Zottman Curl'])
  })

  it('girdi sırası sonucu değiştirmez', () => {
    const records = ['d', 'a', 'c', 'b'].map((id) => atlas({ id, name: { en: id.toUpperCase() } }))
    expect(atlasToCatalog([...records].reverse(), [])).toEqual(atlasToCatalog(records, []))
  })

  it('anahtar sırası bugünkü exercises.json ile aynıdır', () => {
    const { library } = atlasToCatalog(
      [atlas({ id: 'a', name: { en: 'A' }, aliases: ['Aa'], media: [{ path: 'media/exercises/a.webp', role: 'reference' }] })],
      [],
    )
    expect(Object.keys(library[0])).toEqual([
      'id', 'name', 'aliases', 'level', 'equipment', 'category', 'primaryMuscles', 'secondaryMuscles', 'illustration', 'instructions',
    ])
  })
})

describe('atlasToCatalog: hatalar', () => {
  it('yinelenen çalışma zamanı kimliğinde hata verir', () => {
    expect(() =>
      atlasToCatalog(
        [atlas({ id: 'a', name: { en: 'A' }, legacyIds: ['Same'] }), atlas({ id: 'b', name: { en: 'B' }, legacyIds: ['Same'] })],
        [],
      ),
    ).toThrow(/"Same" kimliği a kaydında da var/)
    expect(() => atlasToCatalog([atlas({ id: 'a' }), atlas({ id: 'a' })], [])).toThrow(/tekrar ediyor/)
  })

  it('bir kaydın fazladan eski kimliği başka kaydın kimliğiyle çakışırsa hata verir', () => {
    expect(() =>
      atlasToCatalog(
        [atlas({ id: 'a', name: { en: 'A' }, legacyIds: ['monk-a', 'Taken'] }), atlas({ id: 'b', name: { en: 'B' }, legacyIds: ['Taken'] })],
        [],
      ),
    ).toThrow(/Taken/)
    expect(() => atlasToCatalog([atlas({ id: 'a', legacyIds: ['x', 'x'] })], [])).toThrow(/tekrar ediyor/)
  })

  it('custom- ile başlayan eski kimlik (ilk ya da fazladan) kabul edilmez', () => {
    expect(() => atlasToCatalog([atlas({ id: 'a', legacyIds: ['custom-123'] })], [])).toThrow(/custom-/)
    expect(() => atlasToCatalog([atlas({ id: 'a', legacyIds: ['ok', 'custom-123'] })], [])).toThrow(/custom-/)
  })

  it('bilinmeyen kas, ekipman, seviye ve kategori kodlarında hata verir', () => {
    expect(() => atlasToCatalog([atlas({ id: 'a', primaryMuscles: ['pecs'] })], [])).toThrow(/bilinmeyen kas kodu "pecs"/)
    expect(() => atlasToCatalog([atlas({ id: 'a', equipment: ['rope'] })], [])).toThrow(/bilinmeyen ekipman kodu "rope"/)
    expect(() => atlasToCatalog([atlas({ id: 'a', difficulty: 'elite' })], [])).toThrow(/difficulty/)
    expect(() => atlasToCatalog([atlas({ id: 'a', category: 'constructor' })], [])).toThrow(/category/)
  })

  it('yönergesi ve adı olmayan kayıtta hata verir', () => {
    expect(() => atlasToCatalog([atlas({ id: 'a', instructions: { en: [] } })], [])).toThrow(/yönerge yok/)
    expect(() => atlasToCatalog([atlas({ id: 'a', name: { en: ' ' } })], [])).toThrow(/name\.en/)
  })
})
