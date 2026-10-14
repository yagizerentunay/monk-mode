import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { exerciseSummary } from './exerciseStats.ts'
import { isRecentRecord, personalRecords, RECENT_RECORD_DAYS } from './records.ts'
import { isPR } from './workout.ts'

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })
const entry = (exId: string, sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({ exId, sets, ...extra })
const wk = (id: string, d: string, entries: WorkoutEntry[]): Workout => ({ id, d, start: 0, name: 'A', entries })

describe('personalRecords', () => {
  it('antrenman yoksa boş liste döner', () => {
    expect(personalRecords([])).toEqual([])
  })

  it('en iyi 1RM setini, en ağır seti ve seans sayısını verir', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [entry('bench', [set(100, 5), set(110, 1)])]),
      wk('2', '2026-10-08', [entry('bench', [set(60, 12)])]),
    ])
    expect(recs).toHaveLength(1)
    const r = recs[0]
    expect(r.sessions).toBe(2)
    expect(r.e1rm).toMatchObject({ d: '2026-10-01', set: { w: 100, r: 5 } })
    expect(r.e1rm?.value).toBeCloseTo(100 * (1 + 5 / 30))
    expect(r.top).toMatchObject({ d: '2026-10-01', set: { w: 110, r: 1 } })
    expect(r.d).toBe('2026-10-01')
  })

  it('ısınma, yapılmamış ve yarım setleri saymaz', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [
        entry('squat', [
          set(150, 5, { warmup: true }),
          set(200, 5, { done: false }),
          set(180, 0, { done: false, partial: true, sides: { L: { r: 8, done: true }, R: { r: 0, done: false } } }),
          set(100, 5),
        ]),
      ]),
    ])
    expect(recs[0].top.set).toMatchObject({ w: 100, r: 5 })
    expect(recs[0].e1rm?.set).toMatchObject({ w: 100, r: 5 })
  })

  it('yalnız ısınma/yapılmamış seti olan egzersiz listelenmez', () => {
    const recs = personalRecords([wk('1', '2026-10-01', [entry('squat', [set(50, 10, { warmup: true }), set(100, 5, { done: false })])])])
    expect(recs).toEqual([])
  })

  it('eşitlikte ilk seansı korur (isPR ile aynı)', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [entry('bench', [set(100, 5)])]),
      wk('2', '2026-10-03', [entry('bench', [set(100, 5)])]),
    ])
    expect(recs[0].e1rm?.d).toBe('2026-10-01')
    expect(recs[0].top.d).toBe('2026-10-01')
    expect(recs[0].d).toBe('2026-10-01')
  })

  it('en ağır sette eşitlik daha çok tekrarla bozulur', () => {
    const recs = personalRecords([wk('1', '2026-10-01', [entry('row', [set(80, 6), set(80, 9), set(80, 8)])])])
    expect(recs[0].top.set.r).toBe(9)
  })

  it('tek taraflı sette zayıf tarafın tekrarı (set.r) kullanılır', () => {
    const sided = set(20, 8, { sides: { L: { r: 10, done: true }, R: { r: 8, done: true } } })
    const recs = personalRecords([wk('1', '2026-10-01', [entry('curl', [sided])])])
    expect(recs[0].e1rm?.value).toBeCloseTo(20 * (1 + 8 / 30))
    expect(recs[0].top.set).toBe(sided)
  })

  it('12 tekrar üstünde 1RM tavanı uygulanır', () => {
    const recs = personalRecords([wk('1', '2026-10-01', [entry('ext', [set(50, 30)])])])
    expect(recs[0].e1rm?.value).toBeCloseTo(50 * (1 + 12 / 30))
  })

  it('vücut ağırlığı: 1RM toplam yükten, en iyi set ek yüke ve tekrara göre', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [entry('pullup', [set(0, 12), set(10, 5)], { bw: true, bwKg: 80 })]),
      wk('2', '2026-10-08', [entry('pullup', [set(0, 15)], { bw: true, bwKg: 80 })]),
    ])
    const r = recs[0]
    expect(r.bw).toBe(true)
    expect(r.top).toMatchObject({ d: '2026-10-01', set: { w: 10, r: 5 } })
    // 90 kg × 5 = 105, 80 kg × 12 (tavan) = 112, ikinci seans 80 × 12 (tavan) eşit: ilk seans kalır.
    expect(r.e1rm?.value).toBeCloseTo(80 * (1 + 12 / 30))
    expect(r.e1rm?.d).toBe('2026-10-01')
    expect(r.e1rm?.set).toMatchObject({ w: 0, r: 12 })
  })

  it('vücut ağırlığı kaydı yoksa 1RM yok ama gizlenmez: en çok tekrar rekordur', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [entry('pushup', [set(0, 20)], { bw: true })]),
      wk('2', '2026-10-09', [entry('pushup', [set(0, 25), set(0, 22)], { bw: true })]),
    ])
    expect(recs).toHaveLength(1)
    expect(recs[0].e1rm).toBeUndefined()
    expect(recs[0].top).toMatchObject({ d: '2026-10-09', set: { r: 25 } })
    expect(recs[0].d).toBe('2026-10-09')
  })

  it('asist (negatif ek yük): daha az asist daha ağırdır', () => {
    const recs = personalRecords([
      wk('1', '2026-10-01', [entry('assist', [set(-30, 8)], { bw: true, bwKg: 80 })]),
      wk('2', '2026-10-08', [entry('assist', [set(-20, 6)], { bw: true, bwKg: 80 })]),
    ])
    expect(recs[0].top).toMatchObject({ d: '2026-10-08', set: { w: -20 } })
  })

  it('aynı seansta aynı egzersiz iki kez geçerse ilki sayılır (exerciseSummary ile aynı)', () => {
    const w = wk('1', '2026-10-01', [entry('bench', [set(60, 5)]), entry('bench', [set(200, 5)])])
    expect(personalRecords([w])[0].top.set.w).toBe(60)
    expect(exerciseSummary([w], 'bench').best?.w).toBe(60)
  })

  it('en yeni rekor günü başta; aynı günde yüksek 1RM, sonra kimlik', () => {
    const recs = personalRecords([
      wk('1', '2026-09-01', [entry('old', [set(100, 5)])]),
      wk('2', '2026-10-05', [entry('b', [set(50, 5)]), entry('a', [set(50, 5)]), entry('heavy', [set(90, 5)])]),
    ])
    expect(recs.map((r) => r.exId)).toEqual(['heavy', 'a', 'b', 'old'])
  })

  it('rekor günü, sonradan kırılmadıysa eski seansta kalır (egzersiz yeni yapılsa da)', () => {
    const recs = personalRecords([
      wk('1', '2026-08-01', [entry('bench', [set(100, 5)])]),
      wk('2', '2026-10-01', [entry('bench', [set(80, 5)])]),
      wk('3', '2026-09-01', [entry('squat', [set(120, 5)])]),
    ])
    expect(recs.map((r) => [r.exId, r.d])).toEqual([['squat', '2026-09-01'], ['bench', '2026-08-01']])
  })

  it('exerciseSummary ve isPR ile tutarlıdır', () => {
    const ws = [
      wk('1', '2026-09-01', [entry('bench', [set(40, 10, { warmup: true }), set(80, 8)])]),
      wk('2', '2026-09-08', [entry('bench', [set(85, 8)]), entry('squat', [set(100, 5)])]),
      wk('3', '2026-09-15', [entry('bench', [set(85, 8)]), entry('squat', [set(90, 8), set(100, 5, { done: false })])]),
      wk('4', '2026-09-22', [entry('bench', [set(70, 12), set(88, 6, { drop: true })]), entry('pullup', [set(5, 8)], { bw: true, bwKg: 80 })]),
    ]
    const recs = personalRecords(ws)
    expect(recs.map((r) => r.exId).sort()).toEqual(['bench', 'pullup', 'squat'])
    for (const r of recs) {
      const sum = exerciseSummary(ws, r.exId)
      expect(r.sessions).toBe(sum.sessions)
      expect(r.e1rm?.value).toBeCloseTo(sum.best?.e1rm ?? NaN)
      expect(r.e1rm?.d).toBe(sum.best?.d)
      // Rekor günü = isPR'ın true döndüğü son seans.
      let lastPrDay: string | undefined
      ws.forEach((w, i) => {
        const e = w.entries.find((x) => x.exId === r.exId)
        if (e && isPR(ws.slice(0, i), e)) lastPrDay = w.d
      })
      expect(r.e1rm?.d).toBe(lastPrDay)
    }
  })
})

describe('isRecentRecord', () => {
  const today = new Date(2026, 9, 14, 21, 30)
  it('son 30 gün bugün dahil sayılır', () => {
    expect(isRecentRecord('2026-10-14', today)).toBe(true)
    expect(isRecentRecord('2026-09-15', today)).toBe(true) // 29 gün önce
    expect(isRecentRecord('2026-09-14', today)).toBe(false) // 30 gün önce
    expect(RECENT_RECORD_DAYS).toBe(30)
  })

  it('gelecek tarih (saat kayması vb.) yeni sayılır', () => {
    expect(isRecentRecord('2026-10-15', today)).toBe(true)
  })

  it('yıl sınırını ve yaz/kış saati geçişini doğru sayar', () => {
    expect(isRecentRecord('2026-12-20', new Date(2027, 0, 18, 23, 59))).toBe(true) // 29 gün
    expect(isRecentRecord('2026-12-19', new Date(2027, 0, 18, 0, 1))).toBe(false) // 30 gün
    // Avrupa kış saati 2026-10-25, ABD yaz saati 2026-03-08: 23 ya da 25 saatlik gün araya girse de gün sayısı doğru kalır.
    expect(isRecentRecord('2026-10-01', new Date(2026, 9, 30, 12))).toBe(true)
    expect(isRecentRecord('2026-10-01', new Date(2026, 10, 1, 0, 30))).toBe(false)
    expect(isRecentRecord('2026-03-10', new Date(2026, 3, 8, 12))).toBe(true)
    expect(isRecentRecord('2026-03-10', new Date(2026, 3, 9, 12))).toBe(false)
  })
})
