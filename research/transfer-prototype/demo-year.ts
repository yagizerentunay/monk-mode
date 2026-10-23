// README ekran görüntüleri için örnek veri (bkz. scripts/screenshots.ts). Uygulamanın `monk_state_v1`
// biçimini düz nesne olarak üretir; src/ tiplerine bağlanmaz ki betik node tsconfig'iyle tek başına
// derlensin. Rastgelelik yok: aynı `today` hep aynı veriyi verir, görüntüler tekrar üretilebilir.

/** Görüntülerin "bugün"ü (Cuma, Legs günü). Yerel gün; tarayıcı bağlamı Europe/Istanbul saat dilimiyle açılır. */
export const DEMO_TODAY = '2026-10-23'
/** Istanbul UTC+3 (yaz saati yok). */
const TZ_OFFSET_MS = 3 * 3600_000

interface Lift {
  exId: string
  sets: number
  reps: number
  repsMax: number
  /** 10 hafta önceki çalışma ağırlığı (kg) ve haftalık artış. */
  from: number
  perWeek: number
  inc: number
  warmups?: number
  timed?: boolean
  restSec?: number
  /** Bu haftadan sonra ilerleme durur (plato); rekor listesinde eski rekorlar da görünsün. */
  plateauAfter?: number
}

const ROUTINES: { id: string; name: string; day: number; lifts: Lift[] }[] = [
  {
    id: 'demo-push',
    name: 'Push',
    day: 1,
    lifts: [
      { exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 4, reps: 5, repsMax: 8, from: 70, perWeek: 2.5, inc: 2.5, warmups: 2, restSec: 180 },
      { exId: 'Barbell_Shoulder_Press', sets: 3, reps: 6, repsMax: 10, from: 40, perWeek: 1.25, inc: 2.5, warmups: 1 },
      { exId: 'atlas:incline-dumbbell-press', sets: 3, reps: 8, repsMax: 12, from: 22, perWeek: 0.5, inc: 2 },
      { exId: 'monk-shoulders-dumbbell-lateral-raise', sets: 3, reps: 12, repsMax: 15, from: 8, perWeek: 0.25, inc: 1, restSec: 60, plateauAfter: 6 },
      { exId: 'Triceps_Pushdown', sets: 3, reps: 10, repsMax: 12, from: 25, perWeek: 1, inc: 2.5, restSec: 60 },
    ],
  },
  {
    id: 'demo-pull',
    name: 'Pull',
    day: 3,
    lifts: [
      { exId: 'monk-lower-back-conventional-deadlift', sets: 3, reps: 5, repsMax: 5, from: 110, perWeek: 5, inc: 5, warmups: 3, restSec: 180 },
      { exId: 'atlas:lat-pulldown', sets: 3, reps: 8, repsMax: 12, from: 50, perWeek: 1.5, inc: 2.5 },
      { exId: 'atlas:seated-cable-row', sets: 3, reps: 8, repsMax: 12, from: 45, perWeek: 1.5, inc: 2.5 },
      { exId: 'Face_Pull', sets: 3, reps: 12, repsMax: 15, from: 15, perWeek: 0.5, inc: 2.5, restSec: 60, plateauAfter: 6 },
      { exId: 'Barbell_Curl', sets: 3, reps: 8, repsMax: 12, from: 25, perWeek: 0.5, inc: 2.5, restSec: 60, plateauAfter: 6 },
    ],
  },
  {
    id: 'demo-legs',
    name: 'Legs',
    day: 5,
    lifts: [
      { exId: 'Barbell_Squat', sets: 4, reps: 5, repsMax: 8, from: 90, perWeek: 3, inc: 2.5, warmups: 3, restSec: 180 },
      { exId: 'Romanian_Deadlift', sets: 3, reps: 8, repsMax: 10, from: 70, perWeek: 2, inc: 2.5 },
      { exId: 'atlas:leg-press', sets: 3, reps: 10, repsMax: 15, from: 140, perWeek: 5, inc: 10 },
      { exId: 'Standing_Calf_Raises', sets: 3, reps: 10, repsMax: 15, from: 60, perWeek: 2, inc: 5, restSec: 60, plateauAfter: 6 },
      { exId: 'Plank', sets: 3, reps: 45, repsMax: 90, from: 0, perWeek: 0, inc: 0, timed: true, restSec: 60 },
    ],
  },
]

// Prototip: hafta sayısı ortam değişkeninden (scripts/demo-data.ts kopyası).
const WEEKS = Number(process.env.WEEKS ?? 52)

function dayNumber(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000
}

function isoDay(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10)
}

/** Yerel saat `hour` için epoch ms. */
function localTime(iso: string, hour: number, minute = 0): number {
  return Date.parse(`${iso}T00:00:00Z`) + (hour * 60 + minute) * 60_000 - TZ_OFFSET_MS
}

function round(value: number, step: number): number {
  return Math.round(value / step) * step
}

/** Bu haftanın Pazartesi'si (gün numarası). */
function mondayOf(iso: string): number {
  const n = dayNumber(iso)
  const dow = new Date(n * 86_400_000).getUTCDay() // 0 = Pazar
  return n - ((dow + 6) % 7)
}

function workSets(lift: Lift, realWeek: number, sessionIndex: number) {
  const plateaued = lift.plateauAfter !== undefined && realWeek > lift.plateauAfter
  const week = plateaued ? (lift.plateauAfter ?? realWeek) : realWeek
  if (lift.timed) {
    const hold = 40 + week * 4
    return Array.from({ length: lift.sets }, (_, i) => ({ w: 0, r: hold - i * 5, done: true }))
  }
  const w = round(lift.from + lift.perWeek * week, lift.inc >= 2.5 ? 2.5 : 1)
  // Tekrar dalgası: ağırlık arttığı haftada alt sınıra yakın, sonra yukarı tırmanır.
  const span = lift.repsMax - lift.reps
  const reps = plateaued ? lift.reps : lift.reps + ((week + sessionIndex) % (span + 1))
  return Array.from({ length: lift.sets }, (_, i) => ({
    w,
    r: Math.max(lift.reps, reps - (i === lift.sets - 1 ? 1 : 0)),
    rir: i === lift.sets - 1 ? 1 : 2,
    done: true,
  }))
}

function warmupSets(lift: Lift, week: number) {
  const work = round(lift.from + lift.perWeek * week, 2.5)
  const ramp = [
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ] as const
  return ramp.slice(3 - (lift.warmups ?? 0)).map(([pct, r]) => ({ w: round(work * pct, 2.5), r, done: true, warmup: true }))
}

export function demoState(today = DEMO_TODAY): Record<string, unknown> {
  const thisMonday = mondayOf(today)
  const todayN = dayNumber(today)
  const workouts: Record<string, unknown>[] = []
  let session = 0

  for (let week = 0; week < WEEKS; week++) {
    const monday = thisMonday - (WEEKS - 1 - week) * 7
    for (const routine of ROUTINES) {
      const dayN = monday + routine.day - 1
      if (dayN >= todayN) continue
      // Gerçekçi boşluklar: iki seans atlanmış, bir hafta tatil.
      if (week === 4 || (week === 7 && routine.id === 'demo-legs') || (week === 2 && routine.id === 'demo-pull')) continue
      const d = isoDay(dayN)
      const start = localTime(d, 18, (session * 7) % 40)
      workouts.push({
        id: `demo-w${session}`,
        d,
        start,
        end: start + (62 + (session % 5) * 4) * 60_000,
        routineId: routine.id,
        name: routine.name,
        entries: routine.lifts.map((lift) => ({
          exId: lift.exId,
          ...(lift.timed ? { timed: true } : {}),
          ...(lift.restSec ? { restSec: lift.restSec } : {}),
          sets: [...(lift.warmups ? warmupSets(lift, week) : []), ...workSets(lift, week, session)],
        })),
      })
      session++
    }
    // Arada bir Cumartesi kol günü: serbest antrenman.
    if (week % 3 === 1 && monday + 5 < todayN) {
      const d = isoDay(monday + 5)
      workouts.push({
        id: `demo-w${session++}`,
        d,
        start: localTime(d, 11),
        end: localTime(d, 11, 40),
        name: 'Serbest antrenman',
        entries: [
          { exId: 'monk-biceps-hammer-curl', sets: workSets({ exId: '', sets: 3, reps: 10, repsMax: 12, from: 12, perWeek: 0.25, inc: 1 }, week, 0) },
          { exId: 'atlas:close-grip-bench-press', sets: workSets({ exId: '', sets: 3, reps: 8, repsMax: 10, from: 55, perWeek: 1, inc: 2.5 }, week, 0) },
        ],
      })
    }
  }

  const bodyweight: { d: string; w: number }[] = []
  for (let n = todayN - WEEKS * 7; n <= todayN; n += 2) {
    const k = n - (todayN - WEEKS * 7)
    // ~-0,3 kg/hafta, küçük deterministik dalgalanma.
    const w = 84.6 - k * 0.043 + [0.2, -0.1, 0.3, -0.2, 0, 0.1, -0.3][k % 7]
    bodyweight.push({ d: isoDay(n), w: Math.round(w * 10) / 10 })
  }

  return {
    version: 1,
    settings: {
      unit: 'kg',
      restSec: 120,
      weekStart: 1,
      plateKit: {
        kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
        lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
      },
      backupRemindDays: 14,
      // Yedek hatırlatması ve iPhone kartı görüntüleri kirletmesin.
      lastBackupAt: localTime(today, 9),
      bodyweightGoal: -0.25,
      progressionRule: 'cautious',
    },
    routines: ROUTINES.map((r) => ({
      id: r.id,
      name: r.name,
      ex: r.lifts.map((l) => ({
        exId: l.exId,
        sets: l.sets,
        reps: l.reps,
        repsMax: l.repsMax,
        weight: round(l.from + l.perWeek * (WEEKS - 1), l.inc >= 2.5 ? 2.5 : 1),
        prog: l.timed ? 'linear' : 'double',
        inc: l.inc,
        ...(l.warmups ? { warmups: l.warmups } : {}),
        ...(l.timed ? { timed: true } : {}),
        ...(l.restSec ? { restSec: l.restSec } : {}),
      })),
    })),
    week: Object.fromEntries(ROUTINES.map((r) => [r.day, r.id])),
    workouts,
    active: null,
    bodyweight,
    customEx: [],
    muscleFix: {},
  }
}
