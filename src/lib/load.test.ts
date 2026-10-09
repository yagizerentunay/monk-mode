import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutEntry } from '../store/schema.ts'
import { exerciseSummary } from './exerciseStats.ts'
import { bodyweightOn, comparableLast, effectiveLoad, formatLoad } from './load.ts'
import { detectPlateau } from './plateau.ts'
import { epley } from './onerm.ts'
import { exerciseHistory, isPR, workoutVolume } from './workout.ts'

const entry = (extra: Partial<WorkoutEntry>, sets: Array<[number, number]>, exId = 'pullup'): WorkoutEntry => ({
  exId,
  sets: sets.map(([w, r]) => ({ w, r, done: true })),
  ...extra,
})

const wk = (i: number, e: WorkoutEntry): Workout => ({
  id: String(i),
  d: `2026-09-${String(i + 1).padStart(2, '0')}`,
  start: i,
  name: 'A',
  entries: [e],
})

describe('effectiveLoad', () => {
  it('bw yoksa w mutlak yüktür (eski kayıtlar), bwKg olsa bile', () => {
    expect(effectiveLoad({}, 60)).toBe(60)
    expect(effectiveLoad({ bwKg: 80 }, 60)).toBe(60)
  })

  it('bw varsa vücut ağırlığına ek yükü ekler; negatif asisti düşer', () => {
    expect(effectiveLoad({ bw: true, bwKg: 67 }, 10)).toBe(77)
    expect(effectiveLoad({ bw: true, bwKg: 67 }, 0)).toBe(67)
    expect(effectiveLoad({ bw: true, bwKg: 67 }, -20)).toBe(47)
  })

  it('vücut ağırlığı kaydı yoksa yalnız ek yük sayılır', () => {
    expect(effectiveLoad({ bw: true }, 10)).toBe(10)
    expect(effectiveLoad({ bw: true }, 0)).toBe(0)
  })
})

describe('bodyweightOn', () => {
  const log = [
    { d: '2026-09-01', w: 70 },
    { d: '2026-09-10', w: 68 },
    { d: '2026-09-20', w: 67 },
  ]

  it('o gün ve öncesindeki en son kaydı seçer', () => {
    expect(bodyweightOn(log, '2026-09-10')).toBe(68)
    expect(bodyweightOn(log, '2026-09-15')).toBe(68)
    expect(bodyweightOn(log, '2026-10-01')).toBe(67)
  })

  it('sonraki kayıtlara bakmaz; kayıt yoksa undefined', () => {
    expect(bodyweightOn(log, '2026-08-31')).toBeUndefined()
    expect(bodyweightOn([], '2026-09-10')).toBeUndefined()
  })

  it('sırasız günlükte de doğru kaydı bulur', () => {
    expect(bodyweightOn([...log].reverse(), '2026-09-15')).toBe(68)
  })

  it('geçersiz (0 / NaN) değeri yok sayar', () => {
    expect(bodyweightOn([{ d: '2026-09-01', w: 0 }], '2026-09-02')).toBeUndefined()
    expect(bodyweightOn([{ d: '2026-09-01', w: NaN }], '2026-09-02')).toBeUndefined()
  })
})

describe('comparableLast', () => {
  const abs = entry({}, [[67, 8]])
  const bw = entry({ bw: true, bwKg: 67 }, [[10, 8]])

  it('aynı ağırlık anlamındaki kaydı korur', () => {
    expect(comparableLast(abs, false)).toBe(abs)
    expect(comparableLast(bw, true)).toBe(bw)
    expect(comparableLast(undefined, true)).toBeUndefined()
  })

  it('farklı anlamdaki kaydı (mutlak ↔ ek yük) yok sayar', () => {
    expect(comparableLast(abs, true)).toBeUndefined()
    expect(comparableLast(bw, false)).toBeUndefined()
  })
})

describe('formatLoad', () => {
  it('normal egzersizde yalnız ağırlık', () => {
    expect(formatLoad(false, 60, 'kg')).toBe('60')
    expect(formatLoad(undefined, 62.5, 'kg')).toBe('62.5')
  })

  it('vücut ağırlığında ek yük, asist ve boş yük', () => {
    expect(formatLoad(true, 10, 'kg')).toBe('+10 kg')
    expect(formatLoad(true, -20, 'kg')).toBe('−20 kg')
    expect(formatLoad(true, 0, 'kg')).toBe('Vücut ağırlığı')
  })

  it('lb biriminde kg değerini dönüştürür', () => {
    expect(formatLoad(true, 10, 'lb')).toBe('+22 lb')
    expect(formatLoad(true, -10, 'lb')).toBe('−22 lb')
  })
})

describe('hacim', () => {
  it('bw egzersizinde vücut ağırlığı + ek yük ile hesaplar', () => {
    const w = wk(0, entry({ bw: true, bwKg: 67 }, [[10, 8], [10, 6]]))
    expect(workoutVolume(w)).toBe(77 * 8 + 77 * 6)
  })

  it('ek yük 0 ise yalnız vücut ağırlığı sayılır; bwKg yoksa yalnız ek yük', () => {
    expect(workoutVolume(wk(0, entry({ bw: true, bwKg: 67 }, [[0, 10]])))).toBe(670)
    expect(workoutVolume(wk(0, entry({ bw: true }, [[0, 10]])))).toBe(0)
    expect(workoutVolume(wk(0, entry({ bw: true }, [[10, 10]])))).toBe(100)
  })

  it('asist yükü vücut ağırlığını aşsa da hacim negatif olmaz', () => {
    expect(workoutVolume(wk(0, entry({ bw: true, bwKg: 60 }, [[-80, 10]])))).toBe(0)
  })

  it('bw olmayan eski kayıt aynı kalır (67 kg mutlak yük)', () => {
    expect(workoutVolume(wk(0, entry({}, [[67, 8]])))).toBe(67 * 8)
  })
})

describe('geçmiş, PR ve plato', () => {
  it('exerciseHistory topW ve e1rm değerini toplam yükten hesaplar', () => {
    const h = exerciseHistory([wk(0, entry({ bw: true, bwKg: 67 }, [[10, 5], [0, 8]]))], 'pullup')
    expect(h[0].topW).toBe(77)
    expect(h[0].e1rm).toBeCloseTo(epley(77, 5))
  })

  it('asistli çalışma toplam yükle sayılır; toplam yük ≤ 0 ise 1RM 0', () => {
    const assisted = exerciseHistory([wk(0, entry({ bw: true, bwKg: 67 }, [[-20, 8]]))], 'pullup')
    expect(assisted[0].topW).toBe(47)
    expect(assisted[0].e1rm).toBeCloseTo(epley(47, 8))
    const over = exerciseHistory([wk(0, entry({ bw: true, bwKg: 60 }, [[-80, 8]]))], 'pullup')
    expect(over[0]).toMatchObject({ topW: 0, e1rm: 0 })
  })

  it('karışık geçmişte (eski mutlak + yeni bw) her kayıt kendi anlamıyla hesaplanır', () => {
    const old = wk(0, entry({}, [[67, 8]]))
    const now = wk(1, entry({ bw: true, bwKg: 67 }, [[10, 8]]))
    const h = exerciseHistory([old, now], 'pullup')
    expect(h.map((p) => p.topW)).toEqual([67, 77])
    expect(h[1].e1rm).toBeGreaterThan(h[0].e1rm)
  })

  it('isPR: ek yüksüz bw seansı eski 67 kg mutlak kaydı geçmez, ek yükle geçer', () => {
    const old = [wk(0, entry({}, [[67, 8]]))]
    expect(isPR(old, entry({ bw: true, bwKg: 67 }, [[0, 8]]))).toBe(false)
    expect(isPR(old, entry({ bw: true, bwKg: 67 }, [[5, 8]]))).toBe(true)
    // Eşit toplam yük rekor değildir; ek yükü tek başına karşılaştırmak yanlış PR verirdi.
    expect(isPR(old, entry({ bw: true, bwKg: 80 }, [[-13, 8]]))).toBe(false)
  })

  it('isPR: ek yük aynı kalsa da PR toplam yükten (vücut ağırlığından) belirlenir', () => {
    const prev = [wk(0, entry({ bw: true, bwKg: 70 }, [[10, 8]]))]
    expect(isPR(prev, entry({ bw: true, bwKg: 66 }, [[10, 8]]))).toBe(false)
    expect(isPR(prev, entry({ bw: true, bwKg: 72 }, [[10, 8]]))).toBe(true)
  })

  it('plato: toplam yük değişmiyorsa (kilo ve ek yük sabit) plato döner', () => {
    const sessions = [70, 70, 70, 70].map((kg, i) => wk(i, entry({ bw: true, bwKg: kg }, [[10, 8]])))
    expect(detectPlateau(sessions, 'pullup')?.sessions).toBe(3)
  })

  it('plato: ek yük sabit kalsa da vücut ağırlığı artarsa rekor sürer', () => {
    const sessions = [66, 67, 68, 69, 70].map((kg, i) => wk(i, entry({ bw: true, bwKg: kg }, [[10, 8]])))
    expect(detectPlateau(sessions, 'pullup')).toBeUndefined()
  })

  it('plato: ek yük artıyorsa uyarı yok, mutlak yükle karışık geçmişte de', () => {
    const sessions = [
      wk(0, entry({}, [[67, 8]])),
      wk(1, entry({ bw: true, bwKg: 67 }, [[5, 8]])),
      wk(2, entry({ bw: true, bwKg: 67 }, [[7.5, 8]])),
      wk(3, entry({ bw: true, bwKg: 67 }, [[10, 8]])),
    ]
    expect(detectPlateau(sessions, 'pullup')).toBeUndefined()
  })
})

describe('exerciseSummary', () => {
  it('en iyi 1RM toplam yükten gelir; set ek yükle ve bw bayrağıyla saklanır', () => {
    const s = exerciseSummary([wk(0, entry({ bw: true, bwKg: 67 }, [[0, 10], [10, 3]]))], 'pullup')
    expect(s.best).toMatchObject({ w: 0, r: 10, bw: true })
    expect(s.best?.e1rm).toBeCloseTo(epley(67, 10))
    expect(s.last?.bw).toBe(true)
  })

  it('bw olmayan egzersizde bayrak eklenmez', () => {
    const s = exerciseSummary([wk(0, entry({}, [[60, 8]]))], 'pullup')
    expect(s.best).toEqual({ d: '2026-09-01', w: 60, r: 8, e1rm: epley(60, 8) })
    expect(s.last).not.toHaveProperty('bw')
  })
})
