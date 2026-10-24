import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { formatDistanceSet } from './distance.ts'
import { buildCardData, cardFileName, entryDetail, fitText, formatSessionLength, MAX_CARD_EXERCISES, MAX_CARD_PRS, prExIds } from './summaryCard.ts'

const names = (id: string) => ({ bench: 'Bench Press', plank: 'Plank', pullup: 'Barfiks' })[id] ?? id
const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })
const entry = (exId: string, sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({ exId, sets, ...extra })
const workout = (entries: WorkoutEntry[], extra: Partial<Workout> = {}): Workout => ({
  id: 'w',
  d: '2026-10-06',
  start: 0,
  end: 52 * 60000,
  name: 'Push',
  entries,
  ...extra,
})
const opts = { unit: 'kg' as const, names, prs: [] }

describe('buildCardData', () => {
  it('tarih, ad, süre, hacim ve set sayısını hazırlar', () => {
    const w = workout([entry('bench', [set(40, 10, { warmup: true }), set(62.5, 8), set(60, 8)])])
    const data = buildCardData(w, opts)
    expect(data.date).toBe('Salı, 6 Ekim 2026')
    expect(data.title).toBe('Push')
    expect(data.duration).toBe('52 dk')
    // Isınma hacme girmez; ağırlık virgüllü.
    expect(data.volume).toBe('980 kg')
    expect(data.sets).toBe(2)
    expect(data.exercises).toEqual([{ name: 'Bench Press', detail: '2 set · 62,5 kg × 8' }])
  })

  it('süreli harekette en uzun tutuşu saniyeyle yazar, hacim satırı olmaz', () => {
    const w = workout([entry('plank', [set(0, 45), set(0, 90)], { timed: true })])
    const data = buildCardData(w, opts)
    expect(data.volume).toBeUndefined()
    expect(data.exercises[0].detail).toBe('2 set · 1:30')
    expect(entryDetail(entry('plank', [set(10, 40)], { timed: true, bw: true }), 'kg')).toBe('1 set · +10 kg · 40 sn')
  })

  it('mesafe harekette toplam mesafe, süre ve tempoyu yazar, hacim satırı olmaz', () => {
    const w = workout([entry('run', [set(0, 900, { m: 2500 }), set(0, 750, { m: 2500 })], { distance: true })])
    const data = buildCardData(w, opts)
    expect(data.volume).toBeUndefined()
    expect(data.exercises[0].detail).toBe(`2 set · ${formatDistanceSet({ m: 5000, r: 1650 })}`)
    expect(entryDetail(entry('run', [set(0, 0, { m: 0 })], { distance: true }), 'kg')).toBe('1 set')
  })

  it('vücut ağırlığı ve lb birimini uygulamadaki gibi gösterir', () => {
    expect(entryDetail(entry('pullup', [set(0, 8)], { bw: true }), 'kg')).toBe('1 set · Vücut ağırlığı × 8')
    expect(entryDetail(entry('bench', [set(100, 5)]), 'lb')).toBe('1 set · 220,5 lb × 5')
  })

  it('setsiz hareketleri atlar, listeyi ve rekorları kısaltır', () => {
    const many = Array.from({ length: MAX_CARD_EXERCISES + 2 }, (_, i) => entry(`ex${i}`, [set(10, 10)]))
    const w = workout([entry('skip', [set(50, 5, { done: false })]), ...many])
    const prs = ['A', 'B', 'A', 'C', 'D', 'E'].map((name) => ({ name }))
    const data = buildCardData(w, { ...opts, prs })
    expect(data.exercises).toHaveLength(MAX_CARD_EXERCISES)
    expect(data.exercises[0].name).toBe('ex0')
    expect(data.moreExercises).toBe(2)
    // Tekrarlanan ad bir kez sayılır.
    expect(data.prs.map((p) => p.name)).toEqual(['A', 'B', 'C'].slice(0, MAX_CARD_PRS))
    expect(data.morePrs).toBe(2)
  })

  it('dosya adı antrenman gününü taşır', () => {
    expect(cardFileName(workout([]))).toBe('monk-mode-antrenman-2026-10-06.png')
  })
})

describe('formatSessionLength', () => {
  it('en az 1 dk, bir saatten uzunsa saat ve dakika', () => {
    expect(formatSessionLength(workout([], { end: 10_000 }))).toBe('1 dk')
    expect(formatSessionLength(workout([], { end: undefined }))).toBe('1 dk')
    expect(formatSessionLength(workout([], { end: 72 * 60000 }))).toBe('1 sa 12 dk')
    expect(formatSessionLength(workout([], { end: 120 * 60000 }))).toBe('2 sa')
  })
})

describe('prExIds', () => {
  it('yalnız daha önce başlamış antrenmanlarla karşılaştırır', () => {
    const old = workout([entry('bench', [set(60, 5)])], { id: 'a', start: 0 })
    const target = workout([entry('bench', [set(70, 5)]), entry('plank', [set(0, 30)], { timed: true })], { id: 'b', start: 1000 })
    const later = workout([entry('bench', [set(100, 5)])], { id: 'c', start: 2000 })
    expect(prExIds([old, target, later], target)).toEqual(['bench', 'plank'])
    expect(prExIds([old, target, later], old)).toEqual(['bench'])
  })
})

describe('fitText', () => {
  const measure = (t: string) => [...t].length * 10

  it('sığan metni değiştirmez', () => {
    expect(fitText('Bench Press', 110, measure)).toBe('Bench Press')
  })

  it('sığmayanı kırpıp "…" ekler, sondaki boşluğu atar', () => {
    const out = fitText('Bench Press Medium Grip', 100, measure)
    expect(out).toBe('Bench Pre…')
    expect(measure(out)).toBeLessThanOrEqual(100)
    expect(fitText('Bench Press', 70, measure)).toBe('Bench…')
  })

  it('Türkçe harfleri bölmez, hiç yer yoksa yalnız "…"', () => {
    expect(fitText('Göğüs Şınavı', 60, measure)).toBe('Göğüs…')
    expect(fitText('Barfiks', 5, measure)).toBe('…')
  })
})
