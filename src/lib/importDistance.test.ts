import { describe, expect, it } from 'vitest'
import { parseImport } from './importCsv.ts'
import { buildImport, type NameMatcher } from './importWorkouts.ts'

/** Gerçek dışa aktarımların başlıkları (Strong eski/yeni, Hevy metrik/emperyal). */
const STRONG_OLD =
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'
const STRONG_NEW =
  'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes'
const HEVY_KM =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe'
const HEVY_MI =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe'

const noMatch: NameMatcher = () => null
const build = (csv: string, unit: 'kg' | 'lb' = 'kg') => buildImport(parseImport(csv), unit, noMatch, [], [])

describe('mesafe setlerinin içe aktarılması', () => {
  it('Strong yeni düzen: "Distance (meters)" metre, "Seconds" setin süresi; kuvvet satırları aynen kalır', () => {
    const csv = [
      STRONG_NEW,
      '12,2025-05-02 07:15:00,Sabah koşusu,2400,Running,1,0,0,,5020,1785,,',
      '12,2025-05-02 07:15:00,Sabah koşusu,2400,Running,2,0,0,,1000,290,,',
      '12,2025-05-02 07:15:00,Sabah koşusu,2400,Squat (Barbell),1,100,5,8,0,0,,',
    ].join('\n')
    const parsed = parseImport(csv)
    expect(parsed.distanceUnit).toBe('m')
    expect(parsed.skippedRows).toBe(0)
    const [run, squat] = build(csv).workouts[0].entries
    expect(run.distance).toBe(true)
    expect(run.sets).toEqual([
      { w: 0, r: 1785, m: 5020, done: true },
      { w: 0, r: 290, m: 1000, done: true },
    ])
    expect(squat.distance).toBeUndefined()
    expect(squat.sets).toEqual([{ w: 100, r: 5, done: true }])
  })

  it('Strong eski düzen: birimsiz "Distance" kg dosyasında km, lb seçilince mil sayılır', () => {
    const csv = [STRONG_OLD, '2025-05-02 07:15:00,Kardiyo,45m,Cycling,1,0,0,12.5,2700,,,'].join('\n')
    expect(parseImport(csv).distanceUnit).toBeUndefined()
    expect(build(csv, 'kg').workouts[0].entries[0].sets).toEqual([{ w: 0, r: 2700, m: 12500, done: true }])
    expect(build(csv, 'lb').workouts[0].entries[0].sets).toEqual([{ w: 0, r: 2700, m: 20117, done: true }])
  })

  it('Hevy: distance_km ve duration_seconds; süresiz mesafe de alınır', () => {
    const csv = [
      HEVY_KM,
      'Kürek,"2 May 2025, 07:15","2 May 2025, 07:50",,Rowing Machine,,,0,normal,,,2.5,600,',
      'Kürek,"2 May 2025, 07:15","2 May 2025, 07:50",,Rowing Machine,,,1,normal,,,0.5,,',
    ].join('\n')
    const parsed = parseImport(csv)
    expect(parsed.distanceUnit).toBe('km')
    expect(parsed.workouts[0].entries[0].sets).toEqual([
      { type: 'normal', weight: 0, reps: 600, distance: 2.5 },
      { type: 'normal', weight: 0, reps: 0, distance: 0.5 },
    ])
    const entry = build(csv).workouts[0].entries[0]
    expect(entry.distance).toBe(true)
    expect(entry.sets).toEqual([
      { w: 0, r: 600, m: 2500, done: true },
      { w: 0, r: 0, m: 500, done: true },
    ])
  })

  it('Hevy emperyal: distance_miles mil olarak metreye çevrilir', () => {
    const csv = [HEVY_MI, 'Walk,"3 May 2025, 18:00","3 May 2025, 18:40",,Walking,,,0,normal,,,2,2400,'].join('\n')
    expect(parseImport(csv).distanceUnit).toBe('mi')
    expect(build(csv, 'lb').workouts[0].entries[0].sets).toEqual([{ w: 0, r: 2400, m: 3219, done: true }])
  })

  it('tekrarı olan mesafeli satır (kızak itme 20 m × 4) tekrarlı kalır', () => {
    const csv = [STRONG_NEW, '1,2025-05-02 07:15:00,P,600,Sled Push,1,40,4,,20,0,,'].join('\n')
    expect(build(csv).workouts[0].entries[0]).toMatchObject({ sets: [{ w: 40, r: 4, done: true }] })
    expect(build(csv).workouts[0].entries[0].distance).toBeUndefined()
  })

  it('aynı egzersizde mesafe ve tekrarlı set karışırsa sonradan gelen atlanır', () => {
    const csv = [
      STRONG_NEW,
      '1,2025-05-02 07:15:00,P,600,Running,1,0,0,,3000,900,,',
      '1,2025-05-02 07:15:00,P,600,Running,2,0,10,,0,0,,',
    ].join('\n')
    const parsed = parseImport(csv)
    expect(parsed.skippedRows).toBe(1)
    expect(parsed.workouts[0].entries[0].sets).toHaveLength(1)
  })

  it('aşırı mesafe ve süre sınırlara çekilir', () => {
    const csv = [STRONG_NEW, '1,2025-05-02 07:15:00,P,600,Running,1,0,0,,5000000,200000,,'].join('\n')
    expect(build(csv).workouts[0].entries[0].sets).toEqual([{ w: 0, r: 86_400, m: 1_000_000, done: true }])
  })
})
