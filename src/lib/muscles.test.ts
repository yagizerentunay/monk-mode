import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import {
  MUSCLES,
  MUSCLE_LABEL,
  emptyMuscleSets,
  muscleLevel,
  muscleSets,
  sinceDay,
  underTargetMuscles,
  weekComparison,
  weekRanges,
} from './muscles.ts'

const set = (over: Partial<SetEntry> = {}): SetEntry => ({ w: 50, r: 8, done: true, ...over })

const workout = (d: string, entries: Workout['entries']): Workout => ({
  id: d,
  d,
  start: 0,
  name: 'Test',
  entries,
})

const byId = new Map([
  ['bench', { primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'] }],
  ['curl', { primaryMuscles: ['biceps'] }],
  ['odd', { primaryMuscles: ['chest', 'chest'], secondaryMuscles: ['chest', 'triceps', 'triceps', 'bilinmeyen'] }],
])

const all = { from: '2000-01-01' }

describe('kas listesi', () => {
  it('17 kasın hepsinin benzersiz kısa Türkçe etiketi var', () => {
    expect(MUSCLES).toHaveLength(17)
    const labels = MUSCLES.map((m) => MUSCLE_LABEL[m])
    expect(new Set(labels).size).toBe(17)
    for (const l of labels) expect(l.length).toBeLessThanOrEqual(16)
  })

  it('boş küme tüm kaslar için sıfırdır', () => {
    const e = emptyMuscleSets()
    expect(Object.keys(e)).toHaveLength(17)
    expect(Object.values(e).every((v) => v === 0)).toBe(true)
  })
})

describe('kas başına set', () => {
  it('birincil kasa 1, ikincil kasa 0,5 set yazar', () => {
    const r = muscleSets([workout('2026-10-05', [{ exId: 'bench', sets: [set(), set(), set()] }])], byId, all)
    expect(r.chest).toBe(3)
    expect(r.triceps).toBe(1.5)
    expect(r.shoulders).toBe(1.5)
    expect(r.biceps).toBe(0)
  })

  it('ısınma ve yapılmamış setleri saymaz', () => {
    const sets = [set({ warmup: true }), set({ done: false }), set()]
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', sets }])], byId, all)
    expect(r.biceps).toBe(1)
  })

  it('dropsetleri her biri bir set olarak sayar', () => {
    const sets = [set(), set({ drop: true }), set({ drop: true })]
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', sets }])], byId, all)
    expect(r.biceps).toBe(3)
  })

  it('tek taraflı seti iki değil bir set sayar', () => {
    const uni = set({
      sides: { L: { r: 10, done: true }, R: { r: 10, done: true } },
    })
    const r = muscleSets([workout('2026-10-05', [{ exId: 'curl', unilateral: true, sets: [uni, uni] }])], byId, all)
    expect(r.biceps).toBe(2)
  })

  it('tarih aralığının iki ucunu da içerir, dışını saymaz', () => {
    const e = (d: string) => workout(d, [{ exId: 'curl', sets: [set()] }])
    const ws = [e('2026-10-01'), e('2026-10-02'), e('2026-10-05'), e('2026-10-08'), e('2026-10-09')]
    const r = muscleSets(ws, byId, { from: '2026-10-02', to: '2026-10-08' })
    expect(r.biceps).toBe(3)
  })

  it('üst sınır verilmezse sınırsızdır', () => {
    const ws = [workout('2099-01-01', [{ exId: 'curl', sets: [set()] }])]
    expect(muscleSets(ws, byId, { from: '2026-10-01' }).biceps).toBe(1)
  })

  it('bilinmeyen egzersizi ve bilinmeyen kas adını sessizce yok sayar', () => {
    const ws = [
      workout('2026-10-05', [
        { exId: 'yok', sets: [set()] },
        { exId: 'odd', sets: [set()] },
      ]),
    ]
    const r = muscleSets(ws, byId, all)
    expect(r.chest).toBe(1)
    expect(Object.keys(r)).toHaveLength(17)
  })

  it('hem birincil hem ikincil kası yalnız birincil sayar, tekrarlı adı bir kez sayar', () => {
    const r = muscleSets([workout('2026-10-05', [{ exId: 'odd', sets: [set(), set()] }])], byId, all)
    expect(r.chest).toBe(2)
    expect(r.triceps).toBe(1)
  })

  it('girdileri değiştirmez', () => {
    const ws = [workout('2026-10-05', [{ exId: 'bench', sets: [set(), set({ warmup: true })] }])]
    const snap = JSON.stringify(ws)
    const map = new Map([['bench', { primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] }]])
    muscleSets(ws, map, all)
    expect(JSON.stringify(ws)).toBe(snap)
    expect(map.get('bench')).toEqual({ primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] })
  })
})

describe('pencere başlangıcı', () => {
  it('7 gün bugün dahil 6 gün geriye gider', () => {
    expect(sinceDay(7, new Date(2026, 9, 8))).toBe('2026-10-02')
  })

  it('ay sınırını geçer', () => {
    expect(sinceDay(7, new Date(2026, 9, 3))).toBe('2026-09-27')
  })

  it('1 günden küçük değer 1 sayılır', () => {
    expect(sinceDay(0, new Date(2026, 9, 8))).toBe('2026-10-08')
    expect(sinceDay(-3, new Date(2026, 9, 8))).toBe('2026-10-08')
  })
})

describe('kas ısısı', () => {
  it('7 günde 10 set tam ısıdır, yarısı 0,5 verir', () => {
    expect(muscleLevel(10, 7)).toBe(1)
    expect(muscleLevel(5, 7)).toBe(0.5)
  })

  it('hedefin üstünü 1 değerine sıkıştırır', () => {
    expect(muscleLevel(25, 7)).toBe(1)
  })

  it('30 günde hedef orantılı büyür', () => {
    expect(muscleLevel(30, 30)).toBeCloseTo(30 / ((10 * 30) / 7))
    expect(muscleLevel(100, 30)).toBe(1)
  })

  it('geçersiz girdide 0 verir', () => {
    expect(muscleLevel(5, 0)).toBe(0)
    expect(muscleLevel(5, -7)).toBe(0)
    expect(muscleLevel(Number.NaN, 7)).toBe(0)
    expect(muscleLevel(5, Number.POSITIVE_INFINITY)).toBe(0)
    expect(muscleLevel(-2, 7)).toBe(0)
  })
})

describe('takvim haftası aralıkları', () => {
  // 2026-10-08 Perşembe
  const thu = new Date(2026, 9, 8)

  it('Pazartesi başlangıcında hafta Pzt..bugün, geçen hafta tam Pzt..Paz', () => {
    expect(weekRanges(thu, 1)).toEqual({
      thisFrom: '2026-10-05',
      thisTo: '2026-10-08',
      lastFrom: '2026-09-28',
      lastTo: '2026-10-04',
      daysElapsed: 4,
    })
  })

  it('Pazar başlangıcında hafta Pazar günü başlar', () => {
    const r = weekRanges(thu, 0)
    expect(r.thisFrom).toBe('2026-10-04')
    expect(r.lastFrom).toBe('2026-09-27')
    expect(r.lastTo).toBe('2026-10-03')
    expect(r.daysElapsed).toBe(5)
  })

  it('bugün hafta başıysa bu hafta tek gündür; Cumartesi başlangıcı da çalışır', () => {
    const r = weekRanges(new Date(2026, 9, 5), 1)
    expect(r.thisFrom).toBe('2026-10-05')
    expect(r.thisTo).toBe('2026-10-05')
    expect(r.daysElapsed).toBe(1)
    expect(r.lastTo).toBe('2026-10-04')
    expect(weekRanges(thu, 6).thisFrom).toBe('2026-10-03')
  })

  it('bugün haftanın son günüyse 7 gün geçmiştir', () => {
    expect(weekRanges(new Date(2026, 9, 11), 1).daysElapsed).toBe(7)
  })

  it('ay ve yıl sınırını aşar', () => {
    const r = weekRanges(new Date(2027, 0, 1), 1) // Cuma
    expect(r.thisFrom).toBe('2026-12-28')
    expect(r.lastFrom).toBe('2026-12-21')
    expect(r.lastTo).toBe('2026-12-27')
  })

  it('yaz/kış saati geçiş haftalarında günleri kaydırmaz', () => {
    // Avrupa kış saati: 2026-10-25 Pazar; ABD yaz saati: 2026-03-08 Pazar.
    expect(weekRanges(new Date(2026, 9, 28, 12), 1)).toMatchObject({ thisFrom: '2026-10-26', lastFrom: '2026-10-19', lastTo: '2026-10-25' })
    expect(weekRanges(new Date(2026, 9, 25, 0, 30), 1)).toMatchObject({ thisFrom: '2026-10-19', lastFrom: '2026-10-12', lastTo: '2026-10-18' })
    expect(weekRanges(new Date(2026, 2, 9, 12), 1)).toMatchObject({ thisFrom: '2026-03-09', lastFrom: '2026-03-02', lastTo: '2026-03-08' })
  })

  it('geçersiz hafta başlangıcı Pazartesi sayılır, taşan değer mod 7 alınır', () => {
    expect(weekRanges(thu, Number.NaN).thisFrom).toBe('2026-10-05')
    expect(weekRanges(thu, 8).thisFrom).toBe('2026-10-05')
    expect(weekRanges(thu, -6).thisFrom).toBe('2026-10-05')
  })
})

describe('bu hafta ve geçen hafta karşılaştırması', () => {
  const thu = new Date(2026, 9, 8)
  const ws = [
    workout('2026-09-27', [{ exId: 'curl', sets: [set()] }]), // Pazar
    workout('2026-09-28', [{ exId: 'bench', sets: [set(), set(), set()] }]), // geçen hafta ilk gün
    workout('2026-10-04', [{ exId: 'curl', sets: [set(), set()] }]), // geçen hafta son gün (Pazar)
    workout('2026-10-05', [{ exId: 'bench', sets: [set()] }]), // bu hafta ilk gün
    workout('2026-10-08', [{ exId: 'curl', sets: [set(), set(), set()] }]), // bugün
    workout('2026-10-09', [{ exId: 'curl', sets: [set()] }]), // gelecek: sayılmaz
  ]

  it('iki ucu dahil sayar, hafta dışını saymaz', () => {
    const c = weekComparison(ws, byId, thu, 1)
    expect(c.thisWeek.chest).toBe(1)
    expect(c.thisWeek.biceps).toBe(3)
    expect(c.lastWeek.chest).toBe(3)
    expect(c.lastWeek.biceps).toBe(2)
    expect(c.delta.chest).toBe(-2)
    expect(c.delta.biceps).toBe(1)
    expect(c.delta.triceps).toBe(0.5 - 1.5)
  })

  it('hafta başlangıcı sonucu değiştirir', () => {
    // Pazar başlangıcında 09-27 geçen haftaya, 10-04 Pazar bu haftaya girer.
    const c = weekComparison(ws, byId, thu, 0)
    expect(c.lastWeek.biceps).toBe(1)
    expect(c.thisWeek.biceps).toBe(2 + 3)
  })

  it('boş geçmişte her şey sıfırdır', () => {
    const c = weekComparison([], byId, thu, 1)
    expect(Object.values(c.thisWeek).every((v) => v === 0)).toBe(true)
    expect(Object.values(c.delta).every((v) => v === 0)).toBe(true)
  })
})

describe('hedefin altındaki kaslar', () => {
  const base = () => ({ ...emptyMuscleSets(), chest: 4, biceps: 9.5, lats: 12, triceps: 10 })

  it('hedef ve üstündekileri dışarıda bırakır, hedefe en uzak olandan sıralar', () => {
    const r = underTargetMuscles(base(), { eligible: (m) => ['chest', 'biceps', 'lats', 'triceps', 'calves'].includes(m) })
    expect(r.map((u) => u.muscle)).toEqual(['calves', 'chest', 'biceps'])
    expect(r[1]).toEqual({ muscle: 'chest', sets: 4, target: 10, gap: 6 })
  })

  it('limit ve özel hedef uygulanır', () => {
    const r = underTargetMuscles(base(), { limit: 2, eligible: (m) => m === 'chest' || m === 'biceps' || m === 'lats', target: 12 })
    expect(r.map((u) => u.muscle)).toEqual(['chest', 'biceps'])
    expect(underTargetMuscles(base(), { limit: 0 })).toEqual([])
  })

  it('uygunluk süzgeci verilmezse tüm kaslar değerlendirilir', () => {
    expect(underTargetMuscles(base())).toHaveLength(MUSCLES.length - 2)
  })
})
