import { describe, expect, it } from 'vitest'
// ?raw: node tipleri (fs) bu projede yok; Vite JSON'u ham metin olarak verir.
import libraryJson from '../../public/data/exercises.json?raw'
import { buildMatcher, normalizeName, type MatchCandidate } from './matchExercise.ts'

const FIXTURE: MatchCandidate[] = [
  { id: 'bb-bench', name: 'Barbell Bench Press - Medium Grip', equipment: 'barbell' },
  { id: 'db-bench', name: 'Dumbbell Bench Press', equipment: 'dumbbell' },
  { id: 'smith-bench', name: 'Smith Machine Bench Press', equipment: 'machine' },
  { id: 'incline-bb', name: 'Barbell Incline Bench Press - Medium Grip', equipment: 'barbell' },
  { id: 'pullups', name: 'Pullups', equipment: 'body only' },
  { id: 'band-assist', name: 'Band Assisted Pull-Up', equipment: 'other' },
  { id: 'lat', name: 'Wide-Grip Lat Pulldown', equipment: 'cable' },
  { id: 'lat-close', name: 'Close-Grip Front Lat Pulldown', equipment: 'cable' },
  { id: 'plank', name: 'Plank', equipment: 'body only' },
  { id: 'seated-curl', name: 'Seated Leg Curl', equipment: 'machine' },
  { id: 'lying-curl', name: 'Lying Leg Curls', equipment: 'machine' },
]

describe('normalizeName', () => {
  it('küçük harfe çevirir, aksan ve noktalamayı atar', () => {
    expect(normalizeName('  Bench   Press!! ')).toEqual(['bench', 'press'])
    expect(normalizeName('Çekiş Café')).toEqual(['cekis', 'cafe'])
  })

  it('parantez içini ekipman jetonu olarak ana adla birleştirir', () => {
    expect(normalizeName('Bench Press (Barbell)')).toEqual(['bench', 'press', 'barbell'])
    expect(normalizeName('Triceps Pushdown (Cable - Straight Bar)')).toEqual(['tricep', 'pushdown', 'cable', 'straight', 'bar'])
  })

  it('pull up / pull-up / pullups yazımlarını tek jetona indirir', () => {
    const a = normalizeName('Pull Up')
    expect(a).toEqual(['pullup'])
    expect(normalizeName('Pull-Up')).toEqual(a)
    expect(normalizeName('Pullups')).toEqual(a)
  })

  it('kısaltmaları ve eş anlamlıları açar', () => {
    expect(normalizeName('DB Curl')).toEqual(['dumbbell', 'curl'])
    expect(normalizeName('Body Weight Squat')).toContain('bodyonly')
    expect(normalizeName('Overhead Press')).toEqual(normalizeName('Military Press'))
    expect(normalizeName('RDL')).toEqual(['romanian', 'deadlift'])
    expect(normalizeName('Smith Machine Squat')).toEqual(['smith', 'machine', 'squat'])
  })

  it('çoğul ekini kırpar ama press gibi sözcüklere dokunmaz', () => {
    expect(normalizeName('Biceps Curls')).toEqual(['bicep', 'curl'])
    expect(normalizeName('Presses')).toEqual(['press'])
    expect(normalizeName('Leg Press')).toEqual(['leg', 'press'])
  })

  it('dolgu sözcüklerini atar, tutuş adlarını korur', () => {
    expect(normalizeName('Squat with the Bands')).toEqual(['squat', 'band'])
    expect(normalizeName('Wide-Grip Pulldown')).toEqual(['wide', 'grip', 'pulldown'])
  })

  it('boş ve anlamsız girdide boş liste verir', () => {
    expect(normalizeName('3/4 Sit-Up')).toEqual(['3', '4', 'situp'])
    expect(normalizeName('')).toEqual([])
    expect(normalizeName('  ()  ')).toEqual([])
  })
})

describe('buildMatcher (küçük örnek kütüphane)', () => {
  const match = buildMatcher(FIXTURE)

  it('birebir aynı jeton kümesi 1 puanla kazanır', () => {
    expect(match('Pull Up')).toEqual({ id: 'pullups', name: 'Pullups', score: 1 })
    expect(match('Plank')?.id).toBe('plank')
  })

  it('ekipman parantezini kütüphane adındaki ekipmanla eşler', () => {
    expect(match('Bench Press (Barbell)')?.id).toBe('bb-bench')
    expect(match('Bench Press (Dumbbell)')?.id).toBe('db-bench')
    expect(match('Bench Press (Smith Machine)')?.id).toBe('smith-bench')
  })

  it('ekipman çakışmasını reddeder', () => {
    expect(match('Bench Press (Kettlebell)')).toBeNull()
    expect(match('Bench Press (Cable)')).toBeNull()
    // düz "Machine" smith makinesini kapsamaz
    expect(match('Bench Press (Machine)')).toBeNull()
  })

  it('eğim gibi hareketi değiştiren sözcük farkını reddeder', () => {
    expect(match('Incline Bench Press (Barbell)')?.id).toBe('incline-bb')
    expect(match('Incline Bench Press (Dumbbell)')).toBeNull()
  })

  it('ekipmansız adı ekipman adı taşıyan adaya, assisted farkını da pullups\'a eşlemez', () => {
    expect(match('Pull Up (Assisted)')).toBeNull()
  })

  it('belirsiz adlarda null döner', () => {
    expect(match('Leg Curl (Machine)')).toBeNull()
    expect(match('Bench Press')).toBeNull()
  })

  it('tutuş sözcüğü az katkı verir: Lat Pulldown geniş tutuşa gider', () => {
    expect(match('Lat Pulldown (Cable)')?.id).toBe('lat')
  })

  it('bilinmeyen ve boş ad null döner', () => {
    expect(match('Zumba')).toBeNull()
    expect(match('')).toBeNull()
    expect(match('   ')).toBeNull()
  })

  it('aynı girdide deterministik ve önbellekli sonuç verir', () => {
    const a = match('Bench Press (Barbell)')
    expect(match('Bench Press (Barbell)')).toEqual(a)
    expect(buildMatcher(FIXTURE)('Bench Press (Barbell)')).toEqual(a)
    expect(buildMatcher([...FIXTURE].reverse())('Bench Press (Barbell)')).toEqual(a)
  })

  it('eşit kopya kayıtlarda kısa ad, sonra id kazanır', () => {
    const m = buildMatcher([
      { id: 'b', name: 'Foo Curl', equipment: 'dumbbell' },
      { id: 'a', name: 'Foo Curl', equipment: 'dumbbell' },
    ])
    expect(m('Foo Curl (Dumbbell)')?.id).toBe('a')
  })

  it('boş kütüphanede null döner', () => {
    expect(buildMatcher([])('Plank')).toBeNull()
  })
})

describe('gerçek egzersiz kütüphanesi', () => {
  const lib = JSON.parse(libraryJson) as MatchCandidate[]
  const match = buildMatcher(lib)

  const EXPECTED: Array<[string, string | null]> = [
    ['Bench Press (Barbell)', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['Bench Press (Dumbbell)', 'Dumbbell_Bench_Press'],
    ['Incline Bench Press (Barbell)', 'Barbell_Incline_Bench_Press_-_Medium_Grip'],
    ['Incline Bench Press (Dumbbell)', 'Incline_Dumbbell_Press'],
    ['Squat (Barbell)', 'Barbell_Squat'],
    ['Front Squat (Barbell)', 'Front_Barbell_Squat'],
    ['Deadlift (Barbell)', 'Barbell_Deadlift'],
    ['Romanian Deadlift (Barbell)', 'Romanian_Deadlift'],
    ['Sumo Deadlift (Barbell)', 'Sumo_Deadlift'],
    ['Overhead Press (Barbell)', 'Barbell_Shoulder_Press'],
    ['Shoulder Press (Dumbbell)', 'Dumbbell_Shoulder_Press'],
    ['Lat Pulldown (Cable)', 'Wide-Grip_Lat_Pulldown'],
    ['Bicep Curl (Dumbbell)', 'Dumbbell_Bicep_Curl'],
    ['Hammer Curl (Dumbbell)', 'Hammer_Curls'],
    ['Pull Up', 'Pullups'],
    ['Chin Up', 'Chin-Up'],
    ['Leg Press', 'Leg_Press'],
    ['Leg Extension (Machine)', 'Leg_Extensions'],
    ['Seated Leg Curl (Machine)', 'Seated_Leg_Curl'],
    ['Seated Cable Row - V Grip (Cable)', 'Seated_Cable_Rows'],
    ['Triceps Pushdown (Cable - Straight Bar)', 'Triceps_Pushdown'],
    ['Bent Over Row (Barbell)', 'Bent_Over_Barbell_Row'],
    ['Face Pull (Cable)', 'Face_Pull'],
    ['Lateral Raise (Dumbbell)', 'Side_Lateral_Raise'],
    ['Hip Thrust (Barbell)', 'Barbell_Hip_Thrust'],
    ['Plank', 'Plank'],
    ['Push Up', 'Pushups'],
    ['Squat (Smith Machine)', 'Smith_Machine_Squat'],
    // Gerçek bir karşılığı olmayan / belirsiz adlar: özel egzersiz oluşmalı.
    ['Squat', null],
    ['Leg Curl (Machine)', null],
    ['Bulgarian Split Squat (Dumbbell)', null],
    ['Pull Up (Assisted)', null],
    ['Skullcrusher (Barbell)', null],
    ['Pec Deck (Machine)', null],
    ['Zumba', null],
  ]

  it.each(EXPECTED)('%s -> %s', (name, id) => {
    expect(match(name)?.id ?? null).toBe(id)
  })

  it('Bench Press (Dumbbell) barbell bench\'e gitmez', () => {
    expect(match('Bench Press (Dumbbell)')?.id).not.toBe('Barbell_Bench_Press_-_Medium_Grip')
  })

  it('kütüphanenin kendi adı hiçbir zaman başka bir egzersize gitmez (aynı jetonlu kopya kayıtlar hariç)', () => {
    // Kütüphanedeki gerçek ikizler: aynı hareketin farklı adlandırılmış iki kaydı.
    const twins = new Set(['Cable Rope Overhead Triceps Extension', 'Smith Machine Decline Press'])
    const wrong = lib.filter((e) => {
      if (twins.has(e.name)) return false
      const r = match(e.name)
      return r !== null && r.name !== e.name && normalizeName(r.name).sort().join() !== normalizeName(e.name).sort().join()
    })
    expect(wrong.map((e) => e.name + ' => ' + match(e.name)?.name)).toEqual([])
  })

  it('Türkçe uygulama dilindeki Hevy adlarını eşler (gerçek bir Hevy antrenmanından)', () => {
    // Kaynak: Yağız'ın Türkçe Hevy hesabındaki "A Day" antrenmanı (1 Eki 2026).
    const cases: [string, string | null][] = [
      ['Incline Bench Press (Dambıl)', 'Incline_Dumbbell_Press'],
      ['Barfiks', 'Pullups'],
      ['Oturarak Cable Row - V Tutuş', 'Seated_Cable_Rows'],
      ['Lateral Raise (Dambıl)', 'Side_Lateral_Raise'],
      // İngilizce "Pec Deck" de eşleşmiyor: kütüphanede ortak sözcüğü olan karşılığı yok.
      ['Butterfly (Pec Deck)', null],
    ]
    for (const [name, id] of cases) expect([name, match(name)?.id ?? null]).toEqual([name, id])
  })

  it('Türkçe ekipman Dambıl İngilizce Dumbbell ile aynı sonucu verir; çelişen ekipman yine reddedilir', () => {
    expect(match('Bench Press (Dambıl)')?.id).toBe(match('Bench Press (Dumbbell)')?.id)
    expect(match('Bench Press (Dambıl)')?.id).not.toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(normalizeName('Oturarak V Tutuş')).toEqual(['seated', 'grip'])
  })

  it('5000 adı hızlı eşler', () => {
    const t = performance.now()
    for (let i = 0; i < 5000; i++) match(`Unknown Move ${i} (Barbell)`)
    expect(performance.now() - t).toBeLessThan(2000)
  })
})
