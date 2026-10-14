import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SetEntry, Workout } from '../store/schema.ts'
import { heatLevel, heatmapGrid, HEATMAP_WEEKS, monthLabels, monthSummary } from './frequency.ts'
import { doneSetCount } from './workout.ts'

const set = (done = true, extra: Partial<SetEntry> = {}): SetEntry => ({ w: 50, r: 8, done, ...extra })
/** `n` tamamlanmış çalışma setli antrenman. */
const wk = (d: string, n: number, extra: Partial<Workout> = {}): Workout => ({
  id: `${d}-${n}-${Math.random()}`,
  d,
  start: 0,
  name: 'A',
  entries: [{ exId: 'bench', sets: Array.from({ length: n }, () => set()) }],
  ...extra,
})

const flat = (g: ReturnType<typeof heatmapGrid>) => g.weeks.flat()
const find = (g: ReturnType<typeof heatmapGrid>, date: string) => flat(g).find((c) => c.date === date)

describe('heatLevel', () => {
  it('0, 1-9, 10-19 ve 20+ kademeleri', () => {
    expect([0, 1, 9, 10, 19, 20, 55].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })

  it('geçersiz ya da negatif değer 0 sayılır', () => {
    expect([Number.NaN, -3].map(heatLevel)).toEqual([0, 0])
  })
})

describe('heatmapGrid', () => {
  const thu = new Date(2026, 9, 15, 12) // Perşembe

  it('16 sütun x 7 satır; son sütun içinde bulunulan hafta', () => {
    const g = heatmapGrid([], thu, 1)
    expect(g.weeks).toHaveLength(HEATMAP_WEEKS)
    expect(g.weeks.every((c) => c.length === 7)).toBe(true)
    expect(g.weeks[HEATMAP_WEEKS - 1][0].date).toBe('2026-10-12') // Pazartesi
    expect(g.weeks[HEATMAP_WEEKS - 1][6].date).toBe('2026-10-18')
    expect(g.weeks[0][0].date).toBe('2026-06-29') // 15 hafta önce
  })

  it('günler ardışıktır ve tekrarsızdır', () => {
    const days = flat(heatmapGrid([], thu, 1))
    expect(days).toHaveLength(HEATMAP_WEEKS * 7)
    for (let i = 1; i < days.length; i++) expect(days[i].date > days[i - 1].date).toBe(true)
    expect(new Set(days.map((d) => d.date)).size).toBe(days.length)
  })

  it('satırlar hafta başlangıç ayarına uyar (Pazartesi, Pazar, Cumartesi)', () => {
    const dow = (ws: number) => heatmapGrid([], thu, ws).weeks[3].map((c) => new Date(c.date + 'T12:00:00').getDay())
    expect(dow(1)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(dow(0)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(dow(6)).toEqual([6, 0, 1, 2, 3, 4, 5])
  })

  it('bugün Pazar ise Pazartesi başlangıcında son sütunun son satırıdır', () => {
    const g = heatmapGrid([], new Date(2026, 9, 18, 8), 1)
    const last = g.weeks[HEATMAP_WEEKS - 1]
    expect(last[6]).toMatchObject({ date: '2026-10-18', isToday: true, future: false })
  })

  it('bugün Pazartesi iken bugünden sonraki günler "future" işaretlenir', () => {
    const g = heatmapGrid([], new Date(2026, 9, 12, 8), 1)
    const last = g.weeks[HEATMAP_WEEKS - 1]
    expect(last.map((c) => c.future)).toEqual([false, true, true, true, true, true, true])
    expect(last[0].isToday).toBe(true)
    expect(flat(g).filter((c) => c.isToday)).toHaveLength(1)
  })

  it('günlük set sayısı ve antrenman sayısı toplanır; kademe sete göre', () => {
    const g = heatmapGrid([wk('2026-10-13', 12), wk('2026-10-13', 9), wk('2026-10-14', 5), wk('2026-10-15', 25)], thu, 1)
    expect(find(g, '2026-10-13')).toMatchObject({ sets: 21, workouts: 2, level: 3 })
    expect(find(g, '2026-10-14')).toMatchObject({ sets: 5, workouts: 1, level: 1 })
    expect(find(g, '2026-10-15')).toMatchObject({ sets: 25, level: 3 })
    expect(find(g, '2026-10-16')).toMatchObject({ sets: 0, workouts: 0, level: 0, future: true })
  })

  it('yalnız tamamlanan çalışma seti sayılır: ısınma, dropset ve yapılmamış set hariç', () => {
    const w: Workout = {
      id: 'x',
      d: '2026-10-14',
      start: 0,
      name: 'A',
      entries: [{ exId: 'bench', sets: [set(), set(), set(true, { warmup: true }), set(true, { drop: true }), set(false)] }],
    }
    expect(doneSetCount(w).done).toBe(2)
    expect(find(heatmapGrid([w], thu, 1), '2026-10-14')?.sets).toBe(2)
  })

  it('pencere dışındaki antrenmanlar ızgarayı etkilemez', () => {
    const g = heatmapGrid([wk('2026-06-28', 10), wk('2027-01-01', 10)], thu, 1)
    expect(flat(g).every((c) => c.sets === 0)).toBe(true)
  })

  it('yıl sınırını aşan pencere doğru günleri üretir', () => {
    const g = heatmapGrid([wk('2026-12-31', 6), wk('2027-01-01', 7)], new Date(2027, 0, 5, 12), 1)
    expect(find(g, '2026-12-31')?.sets).toBe(6)
    expect(find(g, '2027-01-01')?.sets).toBe(7)
    const dates = flat(g).map((c) => c.date)
    expect(dates).toContain('2026-12-28') // yeni yıl haftasının başı
    expect(g.weeks[HEATMAP_WEEKS - 1][0].date).toBe('2027-01-04')
    expect(g.weeks[0][0].date).toBe('2026-09-21')
  })

  it('29 Şubat dahil artık yılı doğru atlar', () => {
    const dates = flat(heatmapGrid([], new Date(2028, 2, 10, 12), 1)).map((c) => c.date)
    expect(dates).toContain('2028-02-29')
    expect(dates.indexOf('2028-03-01') - dates.indexOf('2028-02-29')).toBe(1)
  })

  it('geçersiz hafta başlangıcı Pazartesi sayılır', () => {
    expect(heatmapGrid([], thu, Number.NaN).weeks[0][0].date).toBe(heatmapGrid([], thu, 1).weeks[0][0].date)
  })

  it('bugünün saati ne olursa olsun aynı ızgara (gece yarısı sınırı)', () => {
    const a = heatmapGrid([], new Date(2026, 9, 15, 0, 0, 1), 1)
    const b = heatmapGrid([], new Date(2026, 9, 15, 23, 59, 59), 1)
    expect(a).toEqual(b)
  })
})

describe('yaz/kış saati geçişleri', () => {
  beforeAll(() => {
    vi.stubEnv('TZ', 'America/New_York')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('saat dilimi gerçekten yaz saatli bir bölgeye alınmıştır', () => {
    expect(new Date(2026, 0, 8, 12).getTimezoneOffset()).not.toBe(new Date(2026, 6, 8, 12).getTimezoneOffset())
  })

  const consecutive = (g: ReturnType<typeof heatmapGrid>) => {
    const days = flat(g).map((c) => c.date)
    for (let i = 1; i < days.length; i++) {
      const [y, m, d] = days[i - 1].split('-').map(Number)
      const next = new Date(y, m - 1, d + 1)
      const want = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      expect(days[i]).toBe(want)
    }
  }

  it('ABD yaz saati (2026-03-08) ve kış saati (2026-11-01) haftalarında günler kaymaz', () => {
    const spring = heatmapGrid([wk('2026-03-08', 4)], new Date(2026, 2, 9, 12), 1)
    consecutive(spring)
    expect(find(spring, '2026-03-08')?.sets).toBe(4)
    expect(find(spring, '2026-03-09')?.isToday).toBe(true)
    const autumn = heatmapGrid([wk('2026-11-01', 4)], new Date(2026, 10, 1, 23, 30), 0)
    consecutive(autumn)
    expect(find(autumn, '2026-11-01')).toMatchObject({ sets: 4, isToday: true })
    expect(autumn.weeks[HEATMAP_WEEKS - 1][0].date).toBe('2026-11-01')
  })

  it('pencere bir geçişi içeriyorsa sütun başları yine 7 günde bir', () => {
    const g = heatmapGrid([], new Date(2026, 3, 20, 12), 1)
    consecutive(g)
    const starts = g.weeks.map((c) => c[0].date)
    expect(starts).toContain('2026-03-02')
    expect(starts).toContain('2026-03-09')
    expect(g.weeks.every((c) => new Date(c[0].date + 'T12:00:00').getDay() === 1)).toBe(true)
  })
})

describe('monthLabels', () => {
  it('ay değişen sütunlara kısa ay adı yazar; ilk sütundan hemen sonra ay değişiyorsa ilk etiket atlanır', () => {
    const g = heatmapGrid([], new Date(2026, 9, 15, 12), 1)
    expect(g.weeks[0][0].date).toBe('2026-06-29')
    // Haziran sütunu (0) ile Temmuz (1) bitişik: çakışmasın diye Haz yazılmaz.
    expect(g.monthLabels).toEqual([
      { col: 1, label: 'Tem' },
      { col: 5, label: 'Ağu' },
      { col: 10, label: 'Eyl' },
      { col: 14, label: 'Eki' },
    ])
  })

  it('ilk sütun yeni bir ayda uzun süre kalıyorsa etiketlenir', () => {
    const g = heatmapGrid([], new Date(2026, 9, 22, 12), 1)
    expect(g.weeks[0][0].date).toBe('2026-07-06')
    expect(g.monthLabels[0]).toEqual({ col: 0, label: 'Tem' })
    expect(monthLabels(g.weeks)).toEqual(g.monthLabels)
  })

  it('yıl geçişinde Ocak etiketi yazılır', () => {
    const labels = heatmapGrid([], new Date(2027, 0, 20, 12), 1).monthLabels.map((l) => l.label)
    expect(labels).toContain('Ara')
    expect(labels[labels.length - 1]).toBe('Oca')
  })

  it('etiketler her gün ve hafta başlangıcında en az iki sütun arayla durur', () => {
    for (let day = 1; day <= 120; day++) {
      for (const ws of [0, 1, 6]) {
        const labels = heatmapGrid([], new Date(2026, 5, day, 12), ws).monthLabels
        for (let i = 1; i < labels.length; i++) expect(labels[i].col - labels[i - 1].col).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('monthSummary', () => {
  it('bu ay ve geçen ay antrenman sayısı', () => {
    const ws = [wk('2026-09-30', 5), wk('2026-10-01', 5), wk('2026-10-14', 5), wk('2026-10-14', 3), wk('2026-08-31', 5)]
    expect(monthSummary(ws, new Date(2026, 9, 15))).toEqual({ thisMonth: 3, lastMonth: 1 })
  })

  it('yılbaşında geçen ay Aralık (önceki yıl)', () => {
    const ws = [wk('2026-12-31', 5), wk('2026-12-01', 5), wk('2027-01-02', 5), wk('2026-11-30', 5), wk('2025-12-15', 5)]
    expect(monthSummary(ws, new Date(2027, 0, 3))).toEqual({ thisMonth: 1, lastMonth: 2 })
  })

  it('veri yoksa 0 ve 0; ay sonunda (31) bile geçen ay doğru bulunur', () => {
    expect(monthSummary([], new Date(2026, 9, 15))).toEqual({ thisMonth: 0, lastMonth: 0 })
    // 31 Mart'tan bir ay öncesi 31 Şubat değildir: taşma Mart'a düşmemeli.
    expect(monthSummary([wk('2026-02-10', 5), wk('2026-03-31', 5)], new Date(2026, 2, 31))).toEqual({ thisMonth: 1, lastMonth: 1 })
  })

  it('gelecek ay kayıtları sayılmaz', () => {
    expect(monthSummary([wk('2026-11-02', 5)], new Date(2026, 9, 15))).toEqual({ thisMonth: 0, lastMonth: 0 })
  })
})
