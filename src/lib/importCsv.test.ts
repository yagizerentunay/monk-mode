import { describe, expect, it } from 'vitest'
import { parseCsv, parseImport } from './importCsv.ts'

const STRONG_OLD =
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'
const STRONG_NEW =
  'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes'
const HEVY =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe'

/** Eski Strong satırı: date, workout, duration, exercise, order, weight, reps. */
function so(date: string, wo: string, dur: string, ex: string, order: string, w: string, reps: string): string {
  return `${date},${wo},${dur},${ex},${order},"${w}",${reps},0,0,,,`
}

/** Hevy satırı: title, start, end, exercise, superset, type, weight, reps. */
function hv(title: string, start: string, end: string, ex: string, sup: string, type: string, w: string, reps: string): string {
  return `${title},"${start}","${end}",,${ex},${sup},,0,${type},${w},${reps},,,`
}

describe('parseCsv', () => {
  it('tırnaklı alanda virgülü korur', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })

  it('çift tırnağı tek tırnağa çevirir', () => {
    expect(parseCsv('"he said ""hi""",x')).toEqual([['he said "hi"', 'x']])
  })

  it('tırnaklı alandaki satır sonunu hücrede tutar', () => {
    expect(parseCsv('a,"l1\nl2"\nb,c')).toEqual([['a', 'l1\nl2'], ['b', 'c']])
  })

  it('CRLF, LF ve CR satır sonlarını tanır', () => {
    expect(parseCsv('a,b\r\nc,d\ne,f\rg,h')).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']])
  })

  it('UTF-8 BOM karakterini atar', () => {
    expect(parseCsv('﻿a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('noktalı virgül ayırıcıyı başlıktan algılar', () => {
    expect(parseCsv('a;b;c\n1;2,5;3')).toEqual([['a', 'b', 'c'], ['1', '2,5', '3']])
  })

  it('sekme ayırıcıyı algılar', () => {
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('tırnak içindeki noktalı virgülü ayırıcı saymaz', () => {
    expect(parseCsv('"a;b;c",d\n1,2')).toEqual([['a;b;c', 'd'], ['1', '2']])
  })

  it('sondaki boş satırları yok sayar, hücreleri kırpmaz', () => {
    expect(parseCsv('a, b \n1,2\n\n\r\n')).toEqual([['a', ' b '], ['1', '2']])
  })

  it('boş metinde boş liste döner', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('Strong eski düzen', () => {
  const csv = [
    STRONG_OLD,
    so('2025-04-29 12:00:00', 'Push', '1h 15m', 'Bench Press (Barbell)', '1', '60', '10'),
    so('2025-04-29 12:00:00', 'Push', '1h 15m', 'Bench Press (Barbell)', '2', '62,5', '8'),
  ].join('\n')

  it('düz "Weight" başlığında birim null, uyarı yok', () => {
    const r = parseImport(csv)
    expect(r.format).toBe('strong')
    expect(r.unit).toBeNull()
    expect(r.warnings).toEqual([])
  })

  it('tarihi yerel saat olarak okur ve günü dizgeden alır', () => {
    const w = parseImport(csv).workouts[0]
    expect(w.start).toBe(new Date(2025, 3, 29, 12, 0, 0).getTime())
    expect(w.date).toBe('2025-04-29')
    expect(w.name).toBe('Push')
  })

  it('ondalık virgülü ve noktayı okur', () => {
    const sets = parseImport(csv).workouts[0].entries[0].sets
    expect(sets).toEqual([
      { type: 'normal', weight: 60, reps: 10 },
      { type: 'normal', weight: 62.5, reps: 8 },
    ])
  })

  it('metin süreyi saniyeye çevirir', () => {
    expect(parseImport(csv).workouts[0].durationSec).toBe(4500)
  })

  it('saniyesiz ve T ayraçlı tarihleri kabul eder', () => {
    const c = [
      STRONG_OLD,
      so('2025-04-29 08:30', 'A', '45m', 'Squat', '1', '100', '5'),
      so('2025-04-30T09:15:20', 'B', '1h', 'Squat', '1', '100', '5'),
    ].join('\n')
    const r = parseImport(c)
    expect(r.workouts[0].start).toBe(new Date(2025, 3, 29, 8, 30, 0).getTime())
    expect(r.workouts[0].durationSec).toBe(2700)
    expect(r.workouts[1].start).toBe(new Date(2025, 3, 30, 9, 15, 20).getTime())
    expect(r.workouts[1].durationSec).toBe(3600)
  })

  it('süre metni çözülemezse undefined bırakır', () => {
    const c = [STRONG_OLD, so('2025-04-29 08:30:00', 'A', 'abc', 'Squat', '1', '100', '5')].join('\n')
    expect(parseImport(c).workouts[0].durationSec).toBeUndefined()
  })

  it('"1h 5m 10s" ve "30s" biçimlerini çözer', () => {
    const c = [
      STRONG_OLD,
      so('2025-04-29 08:00:00', 'A', '1h 5m 10s', 'Squat', '1', '100', '5'),
      so('2025-04-30 08:00:00', 'B', '30s', 'Squat', '1', '100', '5'),
    ].join('\n')
    const r = parseImport(c)
    expect(r.workouts[0].durationSec).toBe(3910)
    expect(r.workouts[1].durationSec).toBe(30)
  })

  it('W ısınma, D drop, F ve sayı normal set olur', () => {
    const d = '2025-04-29 12:00:00'
    const c = [
      STRONG_OLD,
      so(d, 'P', '1h', 'Squat', 'W', '40', '8'),
      so(d, 'P', '1h', 'Squat', '1', '100', '5'),
      so(d, 'P', '1h', 'Squat', 'F', '100', '3'),
      so(d, 'P', '1h', 'Squat', 'D', '80', '6'),
    ].join('\n')
    expect(parseImport(c).workouts[0].entries[0].sets.map((s) => s.type)).toEqual([
      'warmup', 'normal', 'normal', 'drop',
    ])
  })

  it('Rest Timer satırlarını sessizce atlar, sayaca eklemez', () => {
    const d = '2025-04-29 12:00:00'
    const c = [
      STRONG_OLD,
      so(d, 'P', '1h', 'Squat', '1', '100', '5'),
      so(d, 'P', '1h', 'Squat', 'rest timer', '0', '0'),
      so(d, 'P', '1h', 'Squat', 'Rest Timer', '0', '0'),
    ].join('\n')
    const r = parseImport(c)
    expect(r.skippedRows).toBe(0)
    expect(r.warnings).toEqual([])
    expect(r.workouts[0].entries[0].sets).toHaveLength(1)
  })

  it('boş ağırlığı 0, negatif ağırlığı 0 yapar', () => {
    const d = '2025-04-29 12:00:00'
    const c = [
      STRONG_OLD,
      so(d, 'P', '1h', 'Pull Up', '1', '', '10'),
      so(d, 'P', '1h', 'Pull Up', '2', '-5', '10'),
    ].join('\n')
    expect(parseImport(c).workouts[0].entries[0].sets.map((s) => s.weight)).toEqual([0, 0])
  })

  it('aynı gün farklı antrenman adlarını ayrı antrenman sayar', () => {
    const c = [
      STRONG_OLD,
      so('2025-04-29 09:00:00', 'Sabah', '30m', 'Squat', '1', '100', '5'),
      so('2025-04-29 09:00:00', 'Akşam', '30m', 'Squat', '1', '100', '5'),
    ].join('\n')
    expect(parseImport(c).workouts.map((w) => w.name)).toEqual(['Sabah', 'Akşam'])
  })

  it('egzersizleri ilk görünüş sırasıyla gruplar, tekrar eden adı birleştirir', () => {
    const d = '2025-04-29 12:00:00'
    const c = [
      STRONG_OLD,
      so(d, 'P', '1h', 'Squat', '1', '100', '5'),
      so(d, 'P', '1h', 'Bench', '1', '60', '8'),
      so(d, 'P', '1h', 'Squat', '2', '105', '4'),
    ].join('\n')
    const e = parseImport(c).workouts[0].entries
    expect(e.map((x) => x.name)).toEqual(['Squat', 'Bench'])
    expect(e[0].sets.map((s) => s.reps)).toEqual([5, 4])
  })

  it('azalan sıradaki girdiyi eskiden yeniye sıralar', () => {
    const c = [
      STRONG_OLD,
      so('2025-05-02 10:00:00', 'Üçüncü', '30m', 'Squat', '1', '100', '5'),
      so('2025-04-20 10:00:00', 'Birinci', '30m', 'Squat', '1', '100', '5'),
      so('2025-04-25 10:00:00', 'İkinci', '30m', 'Squat', '1', '100', '5'),
    ].join('\n')
    expect(parseImport(c).workouts.map((w) => w.name)).toEqual(['Birinci', 'İkinci', 'Üçüncü'])
  })
})

describe('Strong yeni düzen', () => {
  const row = (n: string, date: string, wo: string, dur: string, ex: string, order: string, w: string, reps: string) =>
    `${n},${date},${wo},${dur},${ex},${order},${w},${reps},,0,0,,`

  it('Weight (kg) başlığından kg birimini ve saniye süreyi okur', () => {
    const c = [STRONG_NEW, row('1', '2025-04-29 12:00:00', 'Push', '3600', 'Bench', '1', '60', '10')].join('\n')
    const r = parseImport(c)
    expect(r.unit).toBe('kg')
    expect(r.workouts[0].durationSec).toBe(3600)
    expect(r.workouts[0].entries[0].sets).toEqual([{ type: 'normal', weight: 60, reps: 10 }])
  })

  it('Weight (lb) ve Weight (lbs) başlıklarında lb birimini verir', () => {
    for (const h of ['Weight (lb)', 'Weight (lbs)']) {
      const c = [
        STRONG_NEW.replace('Weight (kg)', h),
        row('1', '2025-04-29 12:00:00', 'Push', '60', 'Bench', '1', '135', '5'),
      ].join('\n')
      expect(parseImport(c).unit).toBe('lb')
    }
  })

  it('sütunları konuma göre değil adına göre bulur', () => {
    const c = [
      'Reps,Set Order,Exercise Name,Date,Workout Name',
      '5,1,Squat,2025-04-29 12:00:00,Bacak',
    ].join('\n')
    const r = parseImport(c)
    expect(r.unit).toBeNull()
    expect(r.workouts[0].entries[0].sets).toEqual([{ type: 'normal', weight: 0, reps: 5 }])
  })
})

describe('Hevy', () => {
  const d1 = '26 Mar 2024, 17:26'
  const e1 = '26 Mar 2024, 18:41'

  it('başlıktan biçimi tanır, kg birimini verir', () => {
    const r = parseImport([HEVY, hv('Push', d1, e1, 'Bench Press', '', 'normal', '60', '10')].join('\n'))
    expect(r.format).toBe('hevy')
    expect(r.unit).toBe('kg')
    expect(r.workouts[0].name).toBe('Push')
  })

  it('weight_lbs başlığında lb birimini verir', () => {
    const c = [HEVY.replace('weight_kg', 'weight_lbs'), hv('Push', d1, e1, 'Bench', '', 'normal', '135', '5')].join('\n')
    expect(parseImport(c).unit).toBe('lb')
  })

  it('ağırlık sütunu yoksa birim null olur', () => {
    const c = ['title,start_time,exercise_title,reps', 'Push,"26 Mar 2024, 17:26",Bench,5'].join('\n')
    const r = parseImport(c)
    expect(r.unit).toBeNull()
    expect(r.workouts[0].entries[0].sets[0].weight).toBe(0)
  })

  it('"26 Mar 2024, 17:26" biçimini yerel saat olarak okur', () => {
    const w = parseImport([HEVY, hv('Push', d1, e1, 'Bench', '', 'normal', '60', '10')].join('\n')).workouts[0]
    expect(w.start).toBe(new Date(2024, 2, 26, 17, 26, 0).getTime())
    expect(w.date).toBe('2024-03-26')
  })

  it('Türkçe uygulama dilindeki tarihi okur ("1 Eki 2026, 19:52"), Türkçe harfli ay kısaltmalarıyla', () => {
    const months: [string, number][] = [
      ['1 Oca 2026, 08:00', 0], ['2 Şub 2026, 08:00', 1], ['3 Mar 2026, 08:00', 2], ['4 Nis 2026, 08:00', 3],
      ['5 May 2026, 08:00', 4], ['6 Haz 2026, 08:00', 5], ['7 Tem 2026, 08:00', 6], ['8 Ağu 2026, 08:00', 7],
      ['9 Eyl 2026, 08:00', 8], ['1 Eki 2026, 19:52', 9], ['11 Kas 2026, 08:00', 10], ['12 Ara 2026, 08:00', 11],
    ]
    for (const [text, month] of months) {
      const dayStr = text.split(' ')[0]
      const w = parseImport([HEVY, hv('A Day', text, text, 'Barfiks', '', 'normal', '0', '7')].join('\n')).workouts[0]
      expect(w.date.slice(5, 7)).toBe(String(month + 1).padStart(2, '0'))
      expect(w.date.endsWith(String(dayStr).padStart(2, '0'))).toBe(true)
    }
    const eki = parseImport([HEVY, hv('A Day', '1 Eki 2026, 19:52', '1 Eki 2026, 21:26', 'Barfiks', '', 'normal', '0', '7')].join('\n')).workouts[0]
    expect(eki.start).toBe(new Date(2026, 9, 1, 19, 52, 0).getTime())
    expect(eki.durationSec).toBe(94 * 60)
  })

  it('tam ay adı, saniye ve ISO biçimlerini okur, saat dilimini yok sayar', () => {
    const c = [
      HEVY,
      hv('A', '5 March 2024, 07:05:09', '5 March 2024, 08:05:09', 'Bench', '', 'normal', '60', '10'),
      hv('B', '2024-03-26T17:26:00', '2024-03-26T18:26:00', 'Bench', '', 'normal', '60', '10'),
      hv('C', '2024-03-27 06:00', '2024-03-27 07:00', 'Bench', '', 'normal', '60', '10'),
      hv('D', '2024-03-28T06:00:00Z', '2024-03-28T07:00:00Z', 'Bench', '', 'normal', '60', '10'),
    ].join('\n')
    const w = parseImport(c).workouts
    expect(w[0].start).toBe(new Date(2024, 2, 5, 7, 5, 9).getTime())
    expect(w[1].start).toBe(new Date(2024, 2, 26, 17, 26, 0).getTime())
    expect(w[2].start).toBe(new Date(2024, 2, 27, 6, 0, 0).getTime())
    expect(w[3].start).toBe(new Date(2024, 2, 28, 6, 0, 0).getTime())
    expect(w[3].date).toBe('2024-03-28')
  })

  it('süreyi end_time - start_time farkından hesaplar', () => {
    const w = parseImport([HEVY, hv('Push', d1, e1, 'Bench', '', 'normal', '60', '10')].join('\n')).workouts[0]
    expect(w.durationSec).toBe(75 * 60)
  })

  it('end_time yoksa ya da başlangıçtan önceyse süre undefined olur', () => {
    const a = parseImport([HEVY, hv('Push', d1, '', 'Bench', '', 'normal', '60', '10')].join('\n'))
    const b = parseImport([HEVY, hv('Push', e1, d1, 'Bench', '', 'normal', '60', '10')].join('\n'))
    expect(a.workouts[0].durationSec).toBeUndefined()
    expect(b.workouts[0].durationSec).toBeUndefined()
  })

  it('set tiplerini eşler: warmup, dropset, failure, bilinmeyen', () => {
    const c = [
      HEVY,
      hv('P', d1, e1, 'Squat', '', 'warmup', '40', '8'),
      hv('P', d1, e1, 'Squat', '', 'normal', '100', '5'),
      hv('P', d1, e1, 'Squat', '', 'failure', '100', '3'),
      hv('P', d1, e1, 'Squat', '', 'dropset', '80', '6'),
      hv('P', d1, e1, 'Squat', '', 'bilinmeyen', '80', '6'),
    ].join('\n')
    expect(parseImport(c).workouts[0].entries[0].sets.map((s) => s.type)).toEqual([
      'warmup', 'normal', 'normal', 'drop', 'normal',
    ])
  })

  it('superset_id değerini egzersize yazar, ilk dolu değer kazanır', () => {
    const c = [
      HEVY,
      hv('P', d1, e1, 'Curl', '', 'normal', '10', '10'),
      hv('P', d1, e1, 'Curl', '0', 'normal', '10', '10'),
      hv('P', d1, e1, 'Curl', '1', 'normal', '10', '10'),
      hv('P', d1, e1, 'Triceps', '0', 'normal', '20', '10'),
      hv('P', d1, e1, 'Row', '', 'normal', '50', '10'),
    ].join('\n')
    const e = parseImport(c).workouts[0].entries
    expect(e.map((x) => [x.name, x.supersetId])).toEqual([
      ['Curl', '0'],
      ['Triceps', '0'],
      ['Row', undefined],
    ])
    expect(e[0].sets).toHaveLength(3)
  })

  it('(title, start_time) çiftine göre gruplar ve sıralar', () => {
    const c = [
      HEVY,
      hv('Push', '27 Mar 2024, 10:00', '27 Mar 2024, 11:00', 'Bench', '', 'normal', '60', '10'),
      hv('Push', '26 Mar 2024, 10:00', '26 Mar 2024, 11:00', 'Bench', '', 'normal', '60', '10'),
    ].join('\n')
    expect(parseImport(c).workouts.map((w) => w.date)).toEqual(['2024-03-26', '2024-03-27'])
  })
})

describe('atlanan satırlar ve hatalar', () => {
  it('tekrarsız satırları sayar ve tek Türkçe uyarı üretir', () => {
    const d = '2025-04-29 12:00:00'
    const c = [
      STRONG_OLD,
      so(d, 'P', '1h', 'Squat', '1', '100', '5'),
      so(d, 'P', '1h', 'Plank', '1', '0', '0'),
      so(d, 'P', '1h', 'Run', '1', '0', ''),
      so(d, 'P', '1h', '', '1', '10', '5'),
      '',
      ',,,,,,,,,,,',
    ].join('\n')
    const r = parseImport(c)
    expect(r.skippedRows).toBe(3)
    expect(r.warnings).toEqual(['3 satır atlandı (tekrarı olmayan süre/mesafe setleri)'])
  })

  it('seti kalmayan egzersizi ve antrenmanı çıktıdan düşürür', () => {
    const c = [
      STRONG_OLD,
      so('2025-04-29 12:00:00', 'Sadece plank', '10m', 'Plank', '1', '0', '0'),
      so('2025-04-30 12:00:00', 'Karışık', '10m', 'Plank', '1', '0', '0'),
      so('2025-04-30 12:00:00', 'Karışık', '10m', 'Squat', '1', '100', '5'),
    ].join('\n')
    const r = parseImport(c)
    expect(r.workouts).toHaveLength(1)
    expect(r.workouts[0].entries.map((e) => e.name)).toEqual(['Squat'])
  })

  it('atlama yoksa uyarı üretmez', () => {
    const c = [STRONG_OLD, so('2025-04-29 12:00:00', 'P', '1h', 'Squat', '1', '100', '5')].join('\n')
    expect(parseImport(c).warnings).toEqual([])
  })

  it('tanınmayan başlıkta Strong ve Hevy’yi anan Türkçe hata fırlatır', () => {
    expect(() => parseImport('a,b,c\n1,2,3')).toThrow(/Strong veya Hevy/)
    expect(() => parseImport('a,b,c\n1,2,3')).toThrow(/İngilizce/)
  })

  it('boş dosyada Türkçe hata fırlatır', () => {
    expect(() => parseImport('')).toThrow(/boş/)
    expect(() => parseImport('\n\n')).toThrow(/boş/)
  })

  it('BOM’lu ve noktalı virgüllü Strong dosyasını okur', () => {
    const c = '﻿' + [STRONG_OLD, so('2025-04-29 12:00:00', 'P', '1h', 'Squat', '1', '100', '5')]
      .map((l, i) => (i === 0 ? l : l)).join('\n')
    expect(parseImport(c).workouts).toHaveLength(1)
    const semi = 'Date;Workout Name;Exercise Name;Set Order;Weight;Reps\n2025-04-29 12:00:00;P;Squat;1;62,5;5'
    expect(parseImport(semi).workouts[0].entries[0].sets[0]).toEqual({ type: 'normal', weight: 62.5, reps: 5 })
  })
})
