import { describe, expect, it } from 'vitest'
import exercisesFile from '../../public/data/exercises.json?raw'
import type { LibraryRecord } from './exerciseData.ts'
import type { Exercise } from './exercises.ts'
import { buildTemplateRoutines, STARTER_TEMPLATES, substitutesOf } from './starterTemplates.ts'

const records = JSON.parse(exercisesFile) as LibraryRecord[]
const byId = new Map<string, Exercise>(
  records.map((r) => [
    r.id,
    {
      id: r.id,
      name: r.name,
      level: r.level,
      equipment: r.equipment,
      category: r.category,
      primaryMuscles: r.primaryMuscles,
      secondaryMuscles: r.secondaryMuscles,
    },
  ]),
)
const template = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!
let counter = 0
const ids = () => `r${++counter}`

describe('şablon içeriği', () => {
  it('her egzersiz güncel kataloğun kimliğidir (eski/gizli kimlik değil)', () => {
    for (const t of STARTER_TEMPLATES) {
      for (const day of t.days) {
        for (const e of day.ex) expect(byId.has(e.exId), `${t.id}/${day.name}: ${e.exId}`).toBe(true)
      }
    }
  })

  it('makul değerler: tekrar aralığı tutarlı, set 1-5, dinlenme 30-300 sn, günde en çok 7 egzersiz', () => {
    for (const t of STARTER_TEMPLATES) {
      for (const day of t.days) {
        expect(day.ex.length).toBeGreaterThanOrEqual(5)
        expect(day.ex.length).toBeLessThanOrEqual(7)
        const seen = new Set<string>()
        for (const e of day.ex) {
          expect(e.reps).toBeLessThanOrEqual(e.repsMax)
          expect(e.sets).toBeGreaterThanOrEqual(1)
          expect(e.sets).toBeLessThanOrEqual(5)
          expect(e.restSec).toBeGreaterThanOrEqual(30)
          expect(e.restSec).toBeLessThanOrEqual(300)
          expect(seen.has(e.exId), `${day.name} aynı egzersizi iki kez içeriyor: ${e.exId}`).toBe(false)
          seen.add(e.exId)
        }
      }
    }
  })

  it('Full Body önerilen başlangıçtır ve listenin başındadır; PPL 6 gün notu taşır', () => {
    expect(STARTER_TEMPLATES[0].id).toBe('full-body')
    expect(STARTER_TEMPLATES.filter((t) => t.recommended).map((t) => t.id)).toEqual(['full-body'])
    expect(template('ppl').note).toMatch(/^6 gün önerilir/)
    expect(template('ppl').schedule).toMatch(/Altı gün/)
  })

  it('rutin sayıları: Full Body 2, Upper/Lower 4, PPL 3', () => {
    expect(template('full-body').days.map((d) => d.name)).toEqual(['Full Body A', 'Full Body B'])
    expect(template('upper-lower').days).toHaveLength(4)
    expect(template('ppl').days.map((d) => d.name)).toEqual(['Push', 'Pull', 'Legs'])
  })

  it('geçici ikameler bildirilir (Leg Press, Incline Dumbbell Press…) ve tekrar etmez', () => {
    const subs = substitutesOf(template('upper-lower'))
    expect(subs.map((s) => s.for).sort()).toEqual([
      'Dumbbell Split Squat',
      'Incline Dumbbell Press',
      'Leg Press',
      'Machine Pec Fly',
      'Neutral-Grip Lat Pulldown',
    ])
    expect(substitutesOf(template('full-body')).map((s) => s.for).sort()).toEqual(['Incline Dumbbell Press', 'Leg Press'])
  })
})

describe('rutinlere dönüştürme', () => {
  it('yeni kimlikli, ağırlığı boş, çift ilerlemeli rutinler üretir', () => {
    const { routines, missing } = buildTemplateRoutines(template('full-body'), byId, [], ids)
    expect(missing).toEqual([])
    expect(routines).toHaveLength(2)
    expect(new Set(routines.map((r) => r.id)).size).toBe(2)
    const a = routines[0]
    expect(a.name).toBe('Full Body A')
    expect(a.ex).toHaveLength(6)
    const squat = a.ex[0]
    expect(squat).toMatchObject({ exId: 'Barbell_Squat', sets: 3, reps: 6, repsMax: 10, weight: 0, prog: 'double', inc: 5, restSec: 150 })
    expect(a.ex.every((e) => e.weight === 0 && e.prog === 'double')).toBe(true)
  })

  it('plank süreli gelir (hedef saniye, artış yok); vücut ağırlığı ve tek taraflı bayrakları katalogdan', () => {
    const plank = buildTemplateRoutines(template('full-body'), byId, [], ids).routines[0].ex.at(-1)!
    expect(plank).toMatchObject({ exId: 'Plank', timed: true, reps: 20, repsMax: 60, inc: 0, sets: 3 })
    const lowerB = buildTemplateRoutines(template('upper-lower'), byId, [], ids).routines[3]
    const split = lowerB.ex.find((e) => e.exId === 'monk-glutes-bulgarian-split-squat')!
    expect(split.side).toBe(true)
    const calf = buildTemplateRoutines(template('upper-lower'), byId, [], ids).routines[1].ex.find((e) => e.exId === 'Standing_Calf_Raises')!
    expect(calf.bw).toBe(true)
  })

  it('aynı ad doluysa sonek ekler, mevcut rutinlere dokunmaz, şablon içinde de çakışmaz', () => {
    const existing = [{ name: 'Push' }, { name: 'Push (2)' }, { name: 'Başka' }]
    const { routines } = buildTemplateRoutines(template('ppl'), byId, existing, ids)
    expect(routines.map((r) => r.name)).toEqual(['Push (3)', 'Pull', 'Legs'])
    expect(existing).toHaveLength(3)
  })

  it('katalogda olmayan egzersizi atlar ve bildirir', () => {
    const smaller = new Map(byId)
    smaller.delete('Plank')
    const { routines, missing } = buildTemplateRoutines(template('full-body'), smaller, [], ids)
    expect(missing).toEqual(['Plank', 'Plank'])
    expect(routines[0].ex.some((e) => e.exId === 'Plank')).toBe(false)
  })

  it('her şablon her rutinin tüm egzersizlerini üretir (katalogla tam eşleşir)', () => {
    for (const t of STARTER_TEMPLATES) {
      const { routines, missing } = buildTemplateRoutines(t, byId, [], ids)
      expect(missing).toEqual([])
      routines.forEach((r, i) => expect(r.ex).toHaveLength(t.days[i].ex.length))
    }
  })
})
