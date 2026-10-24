import { describe, expect, it } from 'vitest'
import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { CSV_HEADERS, CSV_HEADERS_EN, MEASUREMENT_CSV_HEADERS, measurementsToCsv, workoutsToCsv } from './exportCsv.ts'

const names = (id: string) => ({ bench: 'Bench Press', curl: 'Biceps Curl', pullup: 'Barfiks' })[id] ?? id
const kg = { unit: 'kg' as const, names }

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })
const entry = (exId: string, sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({ exId, sets, ...extra })
const workout = (entries: WorkoutEntry[], extra: Partial<Workout> = {}): Workout => ({
  id: 'w',
  d: '2026-10-05',
  start: 1000,
  name: 'Push',
  entries,
  ...extra,
})

/** BOM'u atar, satırlara ve alanlara böler (bu alan ayrımı tırnaklı alan içermeyen testler içindir). */
function rows(csv: string): string[][] {
  return csv.replace(/^﻿/, '').split('\r\n').filter(Boolean).map((l) => l.split(';'))
}

describe('workoutsToCsv biçimi', () => {
  it('BOM, Türkçe başlık, noktalı virgül ayracı ve CRLF satır sonu kullanır', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(60, 5)])])], kg)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('\r\n')[0]).toBe('﻿' + CSV_HEADERS.join(';'))
    expect(CSV_HEADERS.join(';')).toBe(
      'Tarih;Antrenman;Egzersiz;Set türü;Set no;Taraf;Ağırlık;Vücut ağırlığı;Toplam yük;Tekrar;RIR;Egzersiz notu;Antrenman notu;Süre (sn);Mesafe (m)',
    )
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(rows(csv)[1]).toEqual(['2026-10-05', 'Push', 'Bench Press', 'Çalışma', '1', '', '60', '', '60', '5', '', '', '', '', ''])
  })

  it('ondalıkta virgül kullanır, binlik ayracı koymaz', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(102.5, 5), set(1234.5, 1)])])], kg)
    const [, a, b] = rows(csv)
    expect(a[6]).toBe('102,5')
    expect(b[6]).toBe('1234,5')
    expect(csv).not.toMatch(/\d\.\d/)
  })

  it('hiç antrenman yoksa yalnız başlık satırı yazar', () => {
    expect(workoutsToCsv([], kg)).toBe('﻿' + CSV_HEADERS.join(';') + '\r\n')
  })

  it('notlardaki ; " ve satır sonunu RFC 4180 gibi tırnaklar', () => {
    const csv = workoutsToCsv(
      [workout([entry('bench', [set(60, 5)], { note: 'omuz; "sızı"\nikinci satır' })], { note: 'düz not' })],
      kg,
    )
    expect(csv).toContain('"omuz; ""sızı""\nikinci satır";düz not;;\r\n')
  })

  it('antrenman ve egzersiz adındaki ayracı da tırnaklar', () => {
    const csv = workoutsToCsv([workout([entry('x;y', [set(10, 5)])], { name: 'A; B' })], kg)
    expect(csv).toContain('"A; B";"x;y"')
  })

  it('formül gibi başlayan notu metin olarak bırakır', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(60, 5)], { note: '=1+1' })], { note: '@x' })], kg)
    expect(csv).toContain(";'=1+1;'@x;;\r\n")
  })
})

describe('workoutsToCsv satırlar', () => {
  it('tamamlanmamış setleri atlar', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(60, 5), set(60, 4, { done: false })])])], kg)
    expect(rows(csv)).toHaveLength(2)
  })

  it('ısınma, çalışma ve drop setlerini türüne göre numaralar', () => {
    const csv = workoutsToCsv(
      [
        workout([
          entry('bench', [
            set(20, 8, { warmup: true }),
            set(40, 5, { warmup: true }),
            set(60, 5, { rir: 2 }),
            set(48, 5, { drop: true }),
            set(60, 5),
            set(48, 5, { drop: true }),
          ]),
        ]),
      ],
      kg,
    )
    expect(rows(csv).slice(1).map((r) => [r[3], r[4], r[10]])).toEqual([
      ['Isınma', '1', ''],
      ['Isınma', '2', ''],
      ['Çalışma', '1', '2'],
      ['Drop', '1', ''],
      ['Çalışma', '2', ''],
      ['Drop', '2', ''],
    ])
  })

  it('numaralamada tamamlanmamış setler de sayılır (uygulamadaki set numarasıyla aynı)', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(60, 5, { done: false }), set(60, 5)])])], kg)
    expect(rows(csv)[1][4]).toBe('2')
  })

  it('tek taraflı seti sol ve sağ için iki satıra böler; her satırda kendi tekrarı vardır', () => {
    const sided = set(20, 8, { sides: { L: { r: 10, done: true }, R: { r: 8, done: true } } })
    const csv = workoutsToCsv([workout([entry('curl', [sided, set(20, 8)], { unilateral: true })])], kg)
    expect(rows(csv).slice(1).map((r) => [r[4], r[5], r[9]])).toEqual([
      ['1', 'Sol', '10'],
      ['1', 'Sağ', '8'],
      ['2', '', '8'],
    ])
  })

  it('yarım sette yalnız yapılan tarafı yazar', () => {
    const half = set(20, 0, { done: false, partial: true, sides: { L: { r: 9, done: true }, R: { r: 0, done: false } } })
    const csv = workoutsToCsv([workout([entry('curl', [half], { unilateral: true })])], kg)
    expect(rows(csv).slice(1).map((r) => [r[5], r[9]])).toEqual([['Sol', '9']])
  })

  it('vücut ağırlığı egzersizinde ek yükü, vücut ağırlığını ve toplamı ayrı yazar', () => {
    const csv = workoutsToCsv(
      [workout([entry('pullup', [set(10, 5), set(-20, 8), set(0, 3)], { bw: true, bwKg: 80.5 })])],
      kg,
    )
    expect(rows(csv).slice(1).map((r) => [r[6], r[7], r[8]])).toEqual([
      ['10', '80,5', '90,5'],
      ['-20', '80,5', '60,5'],
      ['0', '80,5', '80,5'],
    ])
  })

  it('vücut ağırlığı kaydı yoksa vücut ağırlığı boş, toplam ek yüktür; normal egzersizde boş kalır', () => {
    const csv = workoutsToCsv(
      [workout([entry('pullup', [set(10, 5)], { bw: true }), entry('bench', [set(60, 5)], { bwKg: 80 })])],
      kg,
    )
    expect(rows(csv).slice(1).map((r) => [r[6], r[7], r[8]])).toEqual([
      ['10', '', '10'],
      ['60', '', '60'],
    ])
  })

  it('lb biriminde ağırlıkları (ve vücut ağırlığını) çevirir', () => {
    const csv = workoutsToCsv([workout([entry('pullup', [set(10, 5)], { bw: true, bwKg: 80 })])], { ...kg, unit: 'lb' })
    // 10 kg = 22 lb; 80 kg = 176,4 lb; 90 kg = 198,4 lb
    expect(rows(csv)[1].slice(6, 9)).toEqual(['22', '176,4', '198,4'])
  })

  it('tarihe, sonra başlangıca, sonra egzersiz ve set sırasına göre dizer', () => {
    const csv = workoutsToCsv(
      [
        workout([entry('bench', [set(1, 1)])], { id: 'c', d: '2026-10-06', start: 1, name: 'C' }),
        workout([entry('curl', [set(2, 1)]), entry('bench', [set(3, 1), set(4, 1)])], { id: 'b', d: '2026-10-05', start: 20, name: 'B' }),
        workout([entry('bench', [set(5, 1)])], { id: 'a', d: '2026-10-05', start: 10, name: 'A' }),
      ],
      kg,
    )
    expect(rows(csv).slice(1).map((r) => [r[1], r[6]])).toEqual([
      ['A', '5'],
      ['B', '2'],
      ['B', '3'],
      ['B', '4'],
      ['C', '1'],
    ])
  })

  it('girdi dizisini değiştirmez; bilinmeyen egzersizde names kimliği döndürebilir', () => {
    const list = [workout([entry('zzz', [set(1, 1)])], { start: 2 }), workout([entry('bench', [set(1, 1)])], { start: 1 })]
    const csv = workoutsToCsv(list, kg)
    expect(list[0].start).toBe(2)
    expect(rows(csv)[2][2]).toBe('zzz')
  })
})

describe('workoutsToCsv süreli setler', () => {
  it('süreyi "Süre (sn)" sütununa yazar, tekrarı boş bırakır', () => {
    const plank = entry('plank', [set(10, 90)], { timed: true, bw: true, bwKg: 80 })
    const csv = workoutsToCsv([workout([plank, entry('bench', [set(60, 5)])])], kg)
    const [header, a, b] = rows(csv)
    const sec = header.indexOf('Süre (sn)')
    const reps = header.indexOf('Tekrar')
    expect([a[reps], a[sec]]).toEqual(['', '90'])
    expect(a[header.indexOf('Toplam yük')]).toBe('90')
    expect([b[reps], b[sec]]).toEqual(['5', ''])
  })

  it('tek taraflı süreli sette her taraf için bir satır yazar', () => {
    const side = entry(
      'side-plank',
      [{ w: 0, r: 30, done: true, sides: { L: { r: 35, done: true }, R: { r: 30, done: true } } }],
      { timed: true, unilateral: true },
    )
    const [header, l, r] = rows(workoutsToCsv([workout([side])], kg))
    const sec = header.indexOf('Süre (sn)')
    expect([l[5], l[10], l[sec]]).toEqual(['Sol', '', '35'])
    expect([r[5], r[sec]]).toEqual(['Sağ', '30'])
  })
})

describe('workoutsToCsv mesafe setleri', () => {
  it('mesafeyi metre, süreyi saniye yazar; ağırlık ve tekrar boş kalır', () => {
    const run = entry('run', [{ w: 0, r: 1650, m: 5000, done: true }, { w: 0, r: 0, m: 800, done: true }], { distance: true })
    const csv = workoutsToCsv([workout([run, entry('bench', [set(60, 5)])])], kg)
    const [header, a, b, c] = rows(csv)
    const col = (name: string) => header.indexOf(name)
    expect(col('Mesafe (m)')).toBe(header.length - 1)
    expect([a[col('Ağırlık')], a[col('Toplam yük')], a[col('Tekrar')], a[col('Süre (sn)')], a[col('Mesafe (m)')]]).toEqual(['', '', '', '1650', '5000'])
    expect([b[col('Süre (sn)')], b[col('Mesafe (m)')]]).toEqual(['0', '800'])
    // Mesafe olmayan egzersizde mesafe sütunu boş.
    expect([c[col('Tekrar')], c[col('Mesafe (m)')]]).toEqual(['5', ''])
  })

  it('tamamlanmamış mesafe setini yazmaz', () => {
    const run = entry('run', [{ w: 0, r: 1650, m: 5000, done: false }], { distance: true })
    expect(rows(workoutsToCsv([workout([run])], kg))).toHaveLength(1)
  })
})

describe('measurementsToCsv', () => {
  it('BOM, Türkçe başlık; her gün bir satır, boş ölçü boş hücre, ondalık virgül', () => {
    const csv = measurementsToCsv([
      { d: '2026-10-08', waist: 83.5 },
      { d: '2026-10-01', waist: 84, chest: 102, arm: 36.5, hip: 98, fat: 17.5 },
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(MEASUREMENT_CSV_HEADERS.join(';')).toBe('Tarih;Bel (cm);Göğüs (cm);Kol (cm);Kalça (cm);Yağ (%)')
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(rows(csv)).toEqual([
      [...MEASUREMENT_CSV_HEADERS],
      ['2026-10-01', '84', '102', '36,5', '98', '17,5'],
      ['2026-10-08', '83,5', '', '', '', ''],
    ])
  })

  it('kayıt yoksa yalnız başlık', () => {
    expect(rows(measurementsToCsv([]))).toEqual([[...MEASUREMENT_CSV_HEADERS]])
  })
})

describe('CSV: İngilizce dosya', () => {
  const en = { ...kg, lang: 'en' as const }
  const enRows = (csv: string) => csv.replace(/^﻿/, '').split('\r\n').filter(Boolean).map((l) => l.split(','))

  it('İngilizce başlık, virgül ayraç ve nokta ondalık kullanır', () => {
    const csv = workoutsToCsv([workout([entry('bench', [set(102.5, 5), set(20, 8, { warmup: true })])])], en)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('\r\n')[0]).toBe('﻿' + CSV_HEADERS_EN.join(','))
    expect(CSV_HEADERS_EN).toHaveLength(CSV_HEADERS.length)
    const [, work, warm] = enRows(csv)
    expect(warm.slice(3, 5)).toEqual(['Warm-up', '1'])
    expect(work).toEqual(['2026-10-05', 'Push', 'Bench Press', 'Working', '1', '', '102.5', '', '102.5', '5', '', '', '', '', ''])
  })

  it('virgül içeren alanı tırnaklar, noktalı virgülü olduğu gibi bırakır', () => {
    const csv = workoutsToCsv([workout([entry('x', [set(10, 5)])], { name: 'Push, heavy; A' })], en)
    expect(csv.split('\r\n')[1]).toBe('2026-10-05,"Push, heavy; A",x,Working,1,,10,,10,5,,,,,')
  })

  it('tek taraflı satırlarda İngilizce taraf adı', () => {
    const sides = { L: { r: 8, done: true }, R: { r: 7, done: true } }
    const csv = workoutsToCsv([workout([entry('curl', [set(12.5, 7, { sides })], { unilateral: true })])], en)
    expect(enRows(csv).slice(1).map((r) => r[5])).toEqual(['Left', 'Right'])
  })

  it('ölçü dosyası: İngilizce başlık ve nokta ondalık', () => {
    const csv = measurementsToCsv([{ d: '2026-10-05', waist: 82.5, fat: 14 }], 'en')
    expect(csv.split('\r\n')[0]).toBe('﻿Date,Waist (cm),Chest (cm),Arm (cm),Hips (cm),Body fat (%)')
    expect(csv.split('\r\n')[1]).toBe('2026-10-05,82.5,,,,14')
  })

  it('Türkçe dosya dil açıkça verilse de aynı kalır', () => {
    const w = [workout([entry('bench', [set(102.5, 5)])])]
    expect(workoutsToCsv(w, { ...kg, lang: 'tr' })).toBe(workoutsToCsv(w, kg))
    expect(measurementsToCsv([{ d: '2026-10-05', waist: 82.5 }], 'tr').split('\r\n')[1]).toBe('2026-10-05;82,5;;;;')
  })
})
