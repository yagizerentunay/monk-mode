import { describe, expect, it } from 'vitest'
import { MAX_PAST_BLOCKS } from '../lib/block.ts'
import { mergeState, totalAdded } from '../lib/mergeBackup.ts'
import { exportBackup, importBackupWithReport } from './backup.ts'
import { migrate, migrateWithReport } from './migrate.ts'
import { describeDropped, droppedTotal, repairedTotal } from './sanitize.ts'
import { defaultState, type State, type Workout } from './schema.ts'

/** Gerçekçi, tamamen geçerli bir state: tek taraflı, ısınma, drop, bw, süperset, not. */
function realistic(): State {
  const s = defaultState()
  s.routines = [
    {
      id: 'r1',
      name: 'Push',
      ex: [
        { exId: 'bench', sets: 3, reps: 8, weight: 60, prog: 'double', inc: 2.5, repsMax: 12, warmups: 2, drops: 1 },
        { exId: 'curl', sets: 3, reps: 10, weight: 12, prog: 'linear', side: true, superset: true, inc: 1, repsMax: 12, restSec: 60 },
        { exId: 'pullup', sets: 4, reps: 6, weight: 0, prog: 'off', bw: true, inc: 0, repsMax: 6 },
      ],
    },
  ]
  s.week = { 1: 'r1', 4: 'r1' }
  const w: Workout = {
    id: 'w1',
    d: '2026-10-01',
    start: 1_000,
    end: 5_000,
    routineId: 'r1',
    name: 'Push',
    note: 'iyi gün',
    entries: [
      {
        exId: 'bench',
        note: 'omuz hafif sızladı',
        sets: [
          { w: 20, r: 10, done: true, warmup: true },
          { w: 60, r: 8, rir: 2, done: true },
          { w: 40, r: 12, done: true, drop: true },
        ],
      },
      {
        exId: 'curl',
        unilateral: true,
        linked: true,
        sets: [
          {
            w: 12,
            r: 9,
            done: true,
            sides: { L: { r: 10, done: true }, R: { r: 9, done: true } },
          },
          {
            w: 12,
            r: 0,
            done: false,
            partial: true,
            sides: { L: { r: 8, done: true }, R: { r: 0, done: false } },
          },
        ],
      },
      { exId: 'pullup', bw: true, bwKg: 80, sets: [{ w: -10, r: 6, rir: 0, done: true }] },
    ],
  }
  s.workouts = [w]
  s.active = { id: 'a1', d: '2026-10-11', start: 9_000, name: 'Aktif', entries: [] }
  s.bodyweight = [
    { d: '2026-09-30', w: 80.2 },
    { d: '2026-10-01', w: 80 },
  ]
  s.customEx = [{ id: 'custom-1', name: 'Özel', primaryMuscles: ['chest'], equipment: 'cable' }]
  s.block = { id: 'b2', start: '2026-09-28', weeks: 5, deload: 4 }
  s.pastBlocks = [
    { id: 'b0', start: '2026-07-06', weeks: 4, deload: 4, end: '2026-08-02', outcome: 'done' },
    { id: 'b1', start: '2026-08-10', weeks: 6, deload: 6, end: '2026-08-20', outcome: 'cancelled' },
  ]
  return s
}

const broken = { id: 'x', d: '2026-10-01', start: 1, name: 'Bozuk' }
const good = (id = 'ok'): Workout => ({
  id,
  d: '2026-10-02',
  start: 2,
  name: 'Sağlam',
  entries: [{ exId: 'bench', sets: [{ w: 50, r: 5, done: true }] }],
})

describe('geçerli veri', () => {
  it('gerçekçi state bayt bayt aynı kalır ve rapor boştur', () => {
    const s = realistic()
    const { state, report } = migrateWithReport(JSON.parse(JSON.stringify(s)))
    expect(state).toEqual(s)
    expect(JSON.stringify(state)).toBe(JSON.stringify(s))
    expect(droppedTotal(report)).toBe(0)
    expect(repairedTotal(report)).toBe(0)
  })

  it('varsayılan state ve yedek gidiş-dönüşü değişmez', () => {
    expect(migrate(defaultState())).toEqual(defaultState())
    const s = realistic()
    const { state, report } = importBackupWithReport(exportBackup(s))
    expect(state).toEqual(s)
    expect(describeDropped(report)).toBe('')
  })

  it('baştan boş antrenman (entries: []) geçerlidir ve atılmaz', () => {
    const empty = { ...broken, entries: [] }
    const { state, report } = migrateWithReport({ workouts: [empty] })
    expect(state.workouts).toEqual([empty])
    expect(droppedTotal(report)).toBe(0)
  })
})

describe('doğrulanmış hata: entries olmayan antrenman', () => {
  it('bozuk kaydı atar, sağlamı korur ve raporlar', () => {
    const { state, report } = migrateWithReport({ workouts: [broken, good()] })
    expect(state.workouts.map((w) => w.id)).toEqual(['ok'])
    expect(report.dropped.workout).toBe(1)
    expect(droppedTotal(report)).toBe(1)
    expect(describeDropped(report)).toBe('1 bozuk kayıt atlandı')
    // Uygulamanın her yerinde `entries` yinelenir; çökmemeli.
    for (const w of state.workouts) for (const e of w.entries) expect(Array.isArray(e.sets)).toBe(true)
  })
})

describe('antrenman', () => {
  it('kimliksiz, günsüz, başlangıçsız ya da nesne olmayan antrenmanı atar', () => {
    const w = good()
    const { state, report } = migrateWithReport({
      workouts: [
        { ...w, id: '' },
        { ...w, id: 5 },
        { ...w, d: '2026-13-40' },
        { ...w, d: 'dün' },
        { ...w, start: 'x' },
        { ...w, start: Infinity },
        { ...w, entries: 'x' },
        null,
        'x',
        [],
        w,
      ],
    })
    expect(state.workouts).toEqual([w])
    expect(report.dropped.workout).toBe(10)
  })

  it('egzersizleri olup hiçbiri kullanılamıyorsa antrenmanı atar; alt kayıtlar çift sayılmaz', () => {
    const { state, report } = migrateWithReport({
      workouts: [{ ...good(), entries: [{ sets: [] }, 'x', { exId: 3, sets: [] }] }],
    })
    expect(state.workouts).toEqual([])
    expect(report.dropped.workout).toBe(1)
    expect(report.dropped.entry).toBe(0)
  })

  it('kullanılamayan egzersizi atar, diğerlerini tutar', () => {
    const w = good()
    const { state, report } = migrateWithReport({ workouts: [{ ...w, entries: [...w.entries, { sets: [] }, null] }] })
    expect(state.workouts[0].entries).toEqual(w.entries)
    expect(report.dropped.entry).toBe(2)
  })

  it('isteğe bağlı alanları onarır: bozuk end/routineId/note atılır, eksik ad doldurulur', () => {
    const { name: _n, ...noName } = good()
    const { state, report } = migrateWithReport({ workouts: [{ ...noName, end: 'x', routineId: 3, note: {} }] })
    const w = state.workouts[0]
    expect(w).not.toHaveProperty('end')
    expect(w).not.toHaveProperty('routineId')
    expect(w).not.toHaveProperty('note')
    expect(w.name).toBe('Antrenman')
    expect(report.repaired.workout).toBe(1)
    expect(report.dropped.workout).toBe(0)
  })

  it('aktif antrenman aynı kurallarla doğrulanır; bozuksa null olur', () => {
    expect(migrateWithReport({ active: broken }).state.active).toBeNull()
    expect(migrateWithReport({ active: broken }).report.dropped.active).toBe(1)
    expect(migrateWithReport({ active: 'x' }).report.dropped.active).toBe(1)
    const a = { ...good('a'), entries: [] }
    const ok = migrateWithReport({ active: a })
    expect(ok.state.active).toEqual(a)
    expect(droppedTotal(ok.report)).toBe(0)
    expect(migrateWithReport({ active: null }).state.active).toBeNull()
  })
})

describe('egzersiz ve set', () => {
  const withSets = (sets: unknown[], extra: object = {}) => ({
    workouts: [{ ...good(), entries: [{ exId: 'bench', sets, ...extra }] }],
  })

  it('nesne olmayan seti atar', () => {
    const { state, report } = migrateWithReport(withSets([null, 'x', 4, [], { w: 1, r: 1, done: true }]))
    expect(state.workouts[0].entries[0].sets).toEqual([{ w: 1, r: 1, done: true }])
    expect(report.dropped.set).toBe(4)
  })

  it('sayıları ve done alanını onarır', () => {
    const { state, report } = migrateWithReport(
      withSets([{ w: 'x', r: NaN, done: 'evet' }, { w: 10, r: -3, done: true }, {}]),
    )
    expect(state.workouts[0].entries[0].sets).toEqual([
      { w: 0, r: 0, done: false },
      { w: 10, r: 0, done: true },
      { w: 0, r: 0, done: false },
    ])
    expect(report.repaired.set).toBe(3)
    expect(report.dropped.set).toBe(0)
  })

  it('geçersiz rir, işaretler ve sides kaldırılır; geçerli olanlar ve alan sırası korunur', () => {
    const { state } = migrateWithReport(
      withSets([
        { w: 1, r: 1, rir: 99, done: true, warmup: 'x', drop: 1, partial: null },
        { w: 1, r: 1, rir: 2, done: true, sides: { L: { r: 1, done: true } } },
        { w: 1, r: 1, done: true, sides: { L: { r: 'x', done: true }, R: { r: 1, done: true } } },
        { rir: 1, done: false, w: 2, r: 3, warmup: false },
      ]),
    )
    const sets = state.workouts[0].entries[0].sets
    expect(sets[0]).toEqual({ w: 1, r: 1, done: true })
    expect(sets[1]).toEqual({ w: 1, r: 1, rir: 2, done: true })
    expect(sets[2]).toEqual({ w: 1, r: 1, done: true })
    expect(JSON.stringify(sets[3])).toBe('{"rir":1,"done":false,"w":2,"r":3,"warmup":false}')
  })

  it('egzersizin bozuk isteğe bağlı alanları atılır, sets yoksa boş dizi olur', () => {
    const { state, report } = migrateWithReport({
      workouts: [
        {
          ...good(),
          entries: [{ exId: 'bench', unilateral: 'x', bwKg: -5, note: 7, linked: true }, { exId: 'row', sets: 'x' }],
        },
      ],
    })
    const [a, b] = state.workouts[0].entries
    expect(a).toEqual({ exId: 'bench', linked: true, sets: [] })
    expect(b).toEqual({ exId: 'row', sets: [] })
    expect(report.repaired.entry).toBe(2)
  })
})

describe('egzersize özel dinlenme', () => {
  it('geçerli restSec kayıtlı antrenmanda korunur', () => {
    const { state, report } = migrateWithReport({
      workouts: [{ ...good(), entries: [{ exId: 'bench', restSec: 150, sets: [{ w: 50, r: 5, done: true }] }] }],
    })
    expect(state.workouts[0].entries[0].restSec).toBe(150)
    expect(repairedTotal(report)).toBe(0)
  })

  it('sıfır, negatif ya da metin restSec atılır ve onarım sayılır', () => {
    const { state, report } = migrateWithReport({
      workouts: [
        {
          ...good(),
          entries: [
            { exId: 'a', restSec: 0, sets: [] },
            { exId: 'b', restSec: -30, sets: [] },
            { exId: 'c', restSec: '90', sets: [] },
          ],
        },
      ],
    })
    expect(state.workouts[0].entries.every((e) => e.restSec === undefined)).toBe(true)
    expect(report.repaired.entry).toBe(3)
  })
})

describe('rutin', () => {
  it('id, ad ya da ex dizisi olmayan rutini atar', () => {
    const r = { id: 'r', name: 'R', ex: [] }
    const { state, report } = migrateWithReport({
      routines: [{ name: 'a', ex: [] }, { id: 'r', ex: [] }, { id: 'r', name: 'a' }, null, 'x', r],
    })
    expect(state.routines).toEqual([r])
    expect(report.dropped.routine).toBe(5)
  })

  it('exId olmayan egzersizi atar, eksik/bozuk alanları nötr varsayılanla onarır', () => {
    const { state, report } = migrateWithReport({
      routines: [
        {
          id: 'r',
          name: 'R',
          ex: [
            { sets: 3 },
            null,
            { exId: 'a' },
            { exId: 'b', sets: 0, reps: NaN, weight: 'x', prog: 'hızlı', inc: -1, repsMax: 'x', warmups: 9, drops: 1.5, restSec: 0, side: 'x' },
            { exId: 'c', sets: 3, reps: 5, weight: -20, prog: 'linear', inc: 2.5, repsMax: 5, bw: true, warmups: 4, drops: 3, restSec: 90 },
          ],
        },
      ],
    })
    const ex = state.routines[0].ex
    expect(ex).toHaveLength(3)
    expect(ex[0]).toEqual({ exId: 'a', sets: 3, reps: 8, weight: 0, prog: 'off', inc: 0, repsMax: 8 })
    expect(ex[1]).toEqual({ exId: 'b', sets: 3, reps: 8, weight: 0, prog: 'off', inc: 0, repsMax: 8 })
    expect(ex[2]).toEqual({ exId: 'c', sets: 3, reps: 5, weight: -20, prog: 'linear', inc: 2.5, repsMax: 5, bw: true, warmups: 4, drops: 3, restSec: 90 })
    expect(report.dropped.routineEx).toBe(2)
    expect(report.repaired.routineEx).toBe(2)
  })
})

describe('hafta, kilo ve özel egzersiz', () => {
  it('haftadan geçersiz günleri ve kimlikleri atar', () => {
    const { state, report } = migrateWithReport({ week: { 0: 'a', 3: 'b', 7: 'c', x: 'd', 2: 5, 4: '' } })
    expect(state.week).toEqual({ 0: 'a', 3: 'b' })
    expect(report.dropped.week).toBe(4)
    expect(migrateWithReport({ week: [] }).report.dropped.week).toBe(1)
    expect(migrateWithReport({ week: 'x' }).state.week).toEqual({})
  })

  it('kilo kayıtlarında gün ve pozitif sonlu ağırlık ister', () => {
    const { state, report } = migrateWithReport({
      bodyweight: [{ d: '2026-10-01', w: 80 }, { d: 'x', w: 80 }, { d: '2026-10-02', w: 'x' }, { d: '2026-10-03', w: 0 }, { d: '2026-10-04', w: Infinity }, null, 7],
    })
    expect(state.bodyweight).toEqual([{ d: '2026-10-01', w: 80 }])
    expect(report.dropped.bodyweight).toBe(6)
  })

  it('özel egzersizde id ve ad ister, kas ve ekipmanı onarır', () => {
    const { state, report } = migrateWithReport({
      customEx: [
        { id: 'c1', name: 'A', primaryMuscles: ['chest', 3, null], equipment: 'bar' },
        { id: 'c2', name: 'B', primaryMuscles: 'x', equipment: 5 },
        { id: '', name: 'C' },
        { id: 'c4' },
        'x',
      ],
    })
    expect(state.customEx).toEqual([
      { id: 'c1', name: 'A', primaryMuscles: ['chest'], equipment: 'bar' },
      { id: 'c2', name: 'B', primaryMuscles: [], equipment: '' },
    ])
    expect(report.dropped.customEx).toBe(3)
    expect(report.repaired.customEx).toBe(1)
  })

  it('dizi olmayan koleksiyon boşalır ve 1 atılmış sayılır; eksik anahtar sessizdir', () => {
    const { state, report } = migrateWithReport({ workouts: 'x', routines: {} })
    expect(state.workouts).toEqual([])
    expect(report.dropped.workout).toBe(1)
    expect(report.dropped.routine).toBe(1)
    expect(droppedTotal(migrateWithReport({}).report)).toBe(0)
  })

  it('kas düzeltmesinden atılanlar sayılır', () => {
    const { report } = migrateWithReport({ muscleFix: { a: { primary: [] }, b: 'x' } })
    expect(report.dropped.muscleFix).toBe(2)
  })

  it('kök nesne değilse atılmış sayılır ve varsayılan döner', () => {
    for (const raw of [null, 'x', 3, []]) {
      const { state, report } = migrateWithReport(raw)
      expect(state).toEqual(defaultState())
      expect(report.dropped.root).toBe(1)
    }
  })
})

describe('importBackupWithReport', () => {
  it('yedekteki bozuk kayıtları sayar ve mesaj üretir', () => {
    const file = JSON.stringify({ app: 'monk-mode', exportedAt: 'x', state: { workouts: [broken, good(), { ...broken, id: 'y' }] } })
    const { state, report } = importBackupWithReport(file)
    expect(state.workouts).toHaveLength(1)
    expect(describeDropped(report)).toBe('2 bozuk kayıt atlandı')
  })

  it('birleştirme yalnız geçerli kayıtları ekler; bozuk sayı ayrıca raporlanır', () => {
    const file = JSON.stringify({ app: 'monk-mode', exportedAt: 'x', state: { workouts: [broken, good('g1')] } })
    const { state: incoming, report } = importBackupWithReport(file)
    const merged = mergeState(defaultState(), incoming)
    expect(merged.state.workouts.map((w) => w.id)).toEqual(['g1'])
    expect(totalAdded(merged.report)).toBe(1)
    expect(droppedTotal(report)).toBe(1)
  })
})

describe('süreli setler', () => {
  /** Plank (ek yük), yan plank (tek taraflı) ve süreli rutin satırı içeren geçerli state. */
  function withTimed(): State {
    const s = defaultState()
    s.routines = [
      {
        id: 'rt',
        name: 'Core',
        ex: [
          { exId: 'plank', sets: 3, reps: 45, weight: 0, prog: 'double', inc: 0, repsMax: 60, timed: true, bw: true },
          { exId: 'side-plank', sets: 2, reps: 30, weight: 0, prog: 'off', inc: 0, repsMax: 30, timed: true, side: true },
        ],
      },
    ]
    s.workouts = [
      {
        id: 'wt',
        d: '2026-10-03',
        start: 3,
        name: 'Core',
        entries: [
          { exId: 'plank', timed: true, bw: true, bwKg: 80, sets: [{ w: 10, r: 90, done: true }] },
          {
            exId: 'side-plank',
            timed: true,
            unilateral: true,
            sets: [{ w: 0, r: 30, done: true, sides: { L: { r: 35, done: true }, R: { r: 30, done: true } } }],
          },
        ],
      },
    ]
    return s
  }

  it('geçerli süreli veri bayt bayt aynı kalır ve yedek gidiş-dönüşü korunur', () => {
    const s = withTimed()
    const { state, report } = migrateWithReport(JSON.parse(JSON.stringify(s)))
    expect(JSON.stringify(state)).toBe(JSON.stringify(s))
    expect(repairedTotal(report)).toBe(0)
    expect(importBackupWithReport(exportBackup(s)).state).toEqual(s)
  })

  it('süreli girdide saniyeyi 3600e kırpar (tek taraflıda iki taraf da) ve onarım sayar', () => {
    const s = withTimed()
    s.workouts[0].entries[0].sets[0].r = 99_999
    s.workouts[0].entries[1].sets[0].sides = { L: { r: 5000, done: true }, R: { r: 20.4, done: true } }
    const { state, report } = migrateWithReport(JSON.parse(JSON.stringify(s)))
    expect(state.workouts[0].entries[0].sets[0].r).toBe(3600)
    expect(state.workouts[0].entries[1].sets[0].sides).toEqual({ L: { r: 3600, done: true }, R: { r: 20, done: true } })
    expect(report.repaired.entry).toBe(2)
    expect(droppedTotal(report)).toBe(0)
  })

  it('süreli olmayan girdide büyük tekrar değerine dokunmaz', () => {
    const w = good('big')
    w.entries[0].sets[0].r = 5000
    expect(migrate({ workouts: [w] }).workouts[0].entries[0].sets[0].r).toBe(5000)
  })

  it('rutinde süreli hedefi 3600e kırpar; süreli olmayanda kırpmaz', () => {
    const s = withTimed()
    s.routines[0].ex[0].reps = 7200
    s.routines[0].ex[0].repsMax = 9000
    s.routines[0].ex.push({ exId: 'x', sets: 3, reps: 5000, weight: 0, prog: 'off', inc: 0, repsMax: 5000 })
    const { state, report } = migrateWithReport(JSON.parse(JSON.stringify(s)))
    expect(state.routines[0].ex[0].reps).toBe(3600)
    expect(state.routines[0].ex[0].repsMax).toBe(3600)
    expect(state.routines[0].ex[2].reps).toBe(5000)
    expect(report.repaired.routineEx).toBe(1)
  })

  it('timed alanı boolean değilse atılır ve girdi onarılır', () => {
    const s = JSON.parse(JSON.stringify(withTimed()))
    s.workouts[0].entries[0].timed = 'evet'
    const { state, report } = migrateWithReport(s)
    expect(state.workouts[0].entries[0].timed).toBeUndefined()
    expect(report.repaired.entry).toBe(1)
  })
})

describe('antrenman bloğu', () => {
  it('kimliği ya da başlangıç günü kullanılamayan bloğu atar ve sayar', () => {
    for (const block of [{ start: '2026-10-05', weeks: 5, deload: 5 }, { id: 'b', start: '2026-02-30', weeks: 5, deload: 5 }, 'x', []]) {
      const { state, report } = migrateWithReport({ block })
      expect(state.block).toBeNull()
      expect(report.dropped.block).toBe(1)
    }
    expect(migrateWithReport({ block: null }).report.dropped.block).toBe(0)
    expect(migrateWithReport({}).state.block).toBeNull()
  })

  it('hafta sayısını 4-6 aralığına, deload haftasını blok içine çeker ve onarım sayar', () => {
    const { state, report } = migrateWithReport({ block: { id: 'b', start: '2026-10-05', weeks: 9, deload: 8, end: 'x' } })
    expect(state.block).toEqual({ id: 'b', start: '2026-10-05', weeks: 6, deload: 6 })
    expect(report.repaired.block).toBe(1)
    expect(migrate({ block: { id: 'b', start: '2026-10-05', weeks: 4, deload: 6 } }).block?.deload).toBe(4)
    expect(migrate({ block: { id: 'b', start: '2026-10-05' } }).block).toEqual({ id: 'b', start: '2026-10-05', weeks: 5, deload: 5 })
    expect(migrate({ block: { id: 'b', start: '2026-10-05', weeks: 3, deload: 'x' } }).block).toEqual({
      id: 'b',
      start: '2026-10-05',
      weeks: 4,
      deload: 4,
    })
  })

  it('geçmişte bitiş günü zorunlu; bilinmeyen sonuç "bitti" olur', () => {
    const { state, report } = migrateWithReport({
      pastBlocks: [
        { id: 'a', start: '2026-01-05', weeks: 4, deload: 4 },
        { id: 'b', start: '2026-02-02', weeks: 4, deload: 4, end: '2026-03-01', outcome: '?' },
        7,
      ],
    })
    expect(state.pastBlocks).toEqual([{ id: 'b', start: '2026-02-02', weeks: 4, deload: 4, end: '2026-03-01', outcome: 'done' }])
    expect(report.dropped.block).toBe(2)
    expect(report.repaired.block).toBe(1)
    expect(migrateWithReport({ pastBlocks: 'x' }).report.dropped.block).toBe(1)
  })

  it('geçmiş MAX_PAST_BLOCKS ile sınırlı; fazlası en eskiden atılır', () => {
    const past = Array.from({ length: MAX_PAST_BLOCKS + 3 }, (_, i) => ({
      id: `p${i}`,
      start: '2026-01-05',
      weeks: 4,
      deload: 4,
      end: `2026-02-${String(i + 1).padStart(2, '0')}`,
      outcome: 'done',
    }))
    const { state, report } = migrateWithReport({ pastBlocks: past })
    expect(state.pastBlocks).toHaveLength(MAX_PAST_BLOCKS)
    expect(state.pastBlocks[0].id).toBe('p3')
    expect(report.dropped.block).toBe(3)
  })

  it('yedekle dışa/içe aktarılan ve birleştirilen bloklar korunur', () => {
    const s = realistic()
    const restored = importBackupWithReport(exportBackup(s)).state
    expect(restored.block).toEqual(s.block)
    expect(restored.pastBlocks).toEqual(s.pastBlocks)
    const { state, report } = mergeState(defaultState(), restored)
    expect(state.block).toEqual(s.block)
    expect(state.pastBlocks).toEqual(s.pastBlocks)
    expect(report.blocks.added).toBe(3)
    expect(totalAdded(mergeState(state, restored).report)).toBe(0)
  })
})
