import { t } from '../i18n/index.ts'
import type { ExCfg, Routine } from '../store/schema.ts'
import type { Exercise } from './exercises.ts'
import { defaultExCfg } from './routineAdd.ts'
import { newId } from './workout.ts'

/**
 * Yeni başlayanlar için hazır rutin şablonları (Full Body, Upper/Lower, PPL). İçerik 20 Ekim 2026'da
 * r/Fitness wiki, Stronger By Science, Renaissance Periodization, Barbell Medicine, StrongLifts ve ACSM 2026
 * bildirisinin taranmasından çıkarılan bir sentezdir (vault: monk-mode başlangıç şablonları araştırması);
 * set, tekrar ve dinlenme değerleri tek bir kaynağın reçetesi değildir. Hepsi çift ilerleme kullanır.
 *
 * Egzersizler kataloğun kimlikleriyle verilir. Katalogda henüz olmayan Neutral-Grip
 * Pulldown için geçici ikame konur ve
 * `subFor` ile işaretlenir; hareket Atlas'a eklenince şablondaki kimlik değiştirilir. Kullanıcının
 * zaten eklediği rutinler şablondan etkilenmez.
 *
 * Açıklamalar ve Türkçe gün adları (Üst Vücut A…) okunduğu anda arayüz dilinde çözülür (getter); rutin
 * eklenirken o anki dildeki ad kullanılır, eklenen rutinin adı sonradan dil değişse de değişmez.
 */

export interface TemplateExercise {
  exId: string
  sets: number
  reps: number
  repsMax: number
  /** Ağırlık artışı (kg); süreli egzersizde yok sayılır. */
  inc: number
  restSec: number
  /** Geçici ikame: asıl önerilen ama katalogda olmayan hareketin adı. */
  subFor?: string
}

export interface TemplateDay {
  /** Eklenecek rutinin adı. */
  name: string
  ex: TemplateExercise[]
}

export interface StarterTemplate {
  id: string
  name: string
  /** Seçim ekranındaki tek satırlık açıklama. */
  summary: string
  /** Haftada kaç antrenman ve hangi sırayla. */
  schedule: string
  /** Varsa uyarı/öneri notu (ör. PPL için 6 gün). */
  note?: string
  /** Yeni başlayan için varsayılan öneri. */
  recommended?: boolean
  days: TemplateDay[]
}

const ex = (
  exId: string,
  sets: number,
  reps: number,
  repsMax: number,
  inc: number,
  restSec: number,
  subFor?: string,
): TemplateExercise => ({ exId, sets, reps, repsMax, inc, restSec, ...(subFor ? { subFor } : {}) })

// Kimlikler (public/data/exercises.json)
const SQUAT = 'Barbell_Squat'
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'
const DB_BENCH = 'Dumbbell_Bench_Press'
const CABLE_ROW = 'atlas:seated-cable-row'
const DB_RDL = 'monk-hamstrings-dumbbell-romanian-deadlift'
const LATERAL = 'monk-shoulders-dumbbell-lateral-raise'
const PLANK = 'Plank'
const LEG_PRESS = 'atlas:leg-press'
const DB_PRESS = 'Dumbbell_Shoulder_Press'
const PULLDOWN = 'atlas:lat-pulldown'
const INCLINE_PRESS = 'atlas:incline-dumbbell-press'
const LEG_CURL = 'monk-hamstrings-seated-leg-curl'
const SEATED_CALF = 'Seated_Calf_Raise'
const PUSHDOWN = 'Triceps_Pushdown'
const DB_CURL = 'Dumbbell_Bicep_Curl'
const LEG_EXT = 'Leg_Extensions'
const STANDING_CALF = 'Standing_Calf_Raises'
const SUPPORTED_ROW = 'monk-middle-back-chest-supported-row'
const CLOSE_PULLDOWN = 'Close-Grip_Front_Lat_Pulldown'
const PEC_DECK = 'atlas:pec-deck-fly'
const CABLE_LATERAL = 'monk-shoulders-cable-lateral-raise'
const OVERHEAD_TRICEPS = 'monk-triceps-overhead-cable-extension'
const INCLINE_CURL = 'Incline_Dumbbell_Curl'
const HIP_THRUST = 'Barbell_Hip_Thrust'
const SPLIT_SQUAT = 'atlas:dumbbell-split-squat'
const LYING_CURL = 'Lying_Leg_Curls'
const KNEE_RAISE = 'monk-abdominals-hanging-knee-raise'
const FACE_PULL = 'Face_Pull'
const HAMMER = 'monk-biceps-hammer-curl'
const CABLE_CRUNCH = 'Cable_Crunch'

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'full-body',
    name: 'Full Body',
    get summary() {
      return t('tpl.fullBody.summary')
    },
    get schedule() {
      return t('tpl.fullBody.schedule')
    },
    recommended: true,
    days: [
      {
        name: 'Full Body A',
        ex: [
          ex(SQUAT, 3, 6, 10, 5, 150),
          ex(BENCH, 3, 6, 10, 2.5, 150),
          ex(CABLE_ROW, 3, 8, 12, 2.5, 90),
          ex(DB_RDL, 3, 8, 12, 2, 120),
          ex(LATERAL, 3, 12, 15, 1, 60),
          ex(PLANK, 3, 20, 60, 0, 60),
        ],
      },
      {
        name: 'Full Body B',
        ex: [
          ex(LEG_PRESS, 3, 8, 12, 5, 120),
          ex(DB_PRESS, 3, 6, 10, 2, 120),
          ex(PULLDOWN, 3, 8, 12, 2.5, 90),
          ex(INCLINE_PRESS, 3, 8, 12, 2.5, 90),
          ex(LEG_CURL, 3, 10, 15, 2.5, 60),
          ex(SEATED_CALF, 3, 10, 15, 2.5, 60),
          ex(PLANK, 3, 20, 60, 0, 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    get summary() {
      return t('tpl.upperLower.summary')
    },
    get schedule() {
      return t('tpl.upperLower.schedule')
    },
    days: [
      {
        get name() {
          return t('tpl.upperA')
        },
        ex: [
          ex(DB_BENCH, 3, 8, 12, 2, 120),
          ex(PULLDOWN, 3, 8, 12, 2.5, 90),
          ex(CABLE_ROW, 3, 8, 12, 2.5, 90),
          ex(DB_PRESS, 2, 8, 12, 2, 90),
          ex(LATERAL, 2, 12, 15, 1, 60),
          ex(PUSHDOWN, 2, 10, 15, 2.5, 60),
          ex(DB_CURL, 2, 10, 15, 1, 60),
        ],
      },
      {
        get name() {
          return t('tpl.lowerA')
        },
        ex: [
          ex(SQUAT, 3, 6, 10, 5, 150),
          ex(DB_RDL, 3, 8, 12, 2, 120),
          ex(LEG_CURL, 3, 10, 15, 2.5, 60),
          ex(LEG_EXT, 2, 12, 15, 2.5, 60),
          ex(STANDING_CALF, 3, 10, 15, 2.5, 60),
          ex(PLANK, 2, 20, 60, 0, 60),
        ],
      },
      {
        get name() {
          return t('tpl.upperB')
        },
        ex: [
          ex(INCLINE_PRESS, 3, 8, 12, 2.5, 90),
          ex(SUPPORTED_ROW, 3, 8, 12, 2, 90),
          ex(CLOSE_PULLDOWN, 2, 8, 12, 2.5, 90, 'Neutral-Grip Lat Pulldown'),
          ex(PEC_DECK, 2, 12, 15, 2.5, 60),
          ex(CABLE_LATERAL, 2, 12, 15, 1, 60),
          ex(OVERHEAD_TRICEPS, 2, 10, 15, 2.5, 60),
          ex(INCLINE_CURL, 2, 10, 15, 1, 60),
        ],
      },
      {
        get name() {
          return t('tpl.lowerB')
        },
        ex: [
          ex(LEG_PRESS, 3, 8, 12, 5, 120),
          ex(HIP_THRUST, 3, 8, 12, 5, 120),
          ex(SPLIT_SQUAT, 2, 8, 12, 2, 90),
          ex(LYING_CURL, 2, 10, 15, 2.5, 60),
          ex(SEATED_CALF, 3, 12, 15, 2.5, 60),
          ex(KNEE_RAISE, 2, 10, 15, 0, 60),
        ],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    get summary() {
      return t('tpl.ppl.summary')
    },
    get schedule() {
      return t('tpl.ppl.schedule')
    },
    get note() {
      return t('tpl.ppl.note')
    },
    days: [
      {
        name: 'Push',
        ex: [
          ex(DB_BENCH, 3, 6, 10, 2, 120),
          ex(DB_PRESS, 3, 8, 12, 2, 120),
          ex(INCLINE_PRESS, 3, 8, 12, 2.5, 90),
          ex(LATERAL, 3, 12, 20, 1, 60),
          ex(PUSHDOWN, 3, 8, 12, 2.5, 60),
          ex(OVERHEAD_TRICEPS, 2, 10, 15, 2.5, 60),
        ],
      },
      {
        name: 'Pull',
        ex: [
          ex(PULLDOWN, 3, 8, 12, 2.5, 90),
          ex(SUPPORTED_ROW, 3, 8, 12, 2, 90),
          ex(CABLE_ROW, 3, 8, 12, 2.5, 90),
          ex(FACE_PULL, 3, 12, 20, 2.5, 60),
          ex(HAMMER, 3, 8, 12, 1, 60),
          ex(DB_CURL, 3, 8, 12, 1, 60),
        ],
      },
      {
        name: 'Legs',
        ex: [
          ex(SQUAT, 3, 5, 8, 5, 150),
          ex(DB_RDL, 3, 8, 12, 2, 120),
          ex(LEG_PRESS, 3, 8, 12, 5, 120),
          ex(LEG_CURL, 3, 8, 12, 2.5, 60),
          ex(STANDING_CALF, 3, 10, 15, 2.5, 60),
          ex(CABLE_CRUNCH, 2, 10, 15, 2.5, 60),
        ],
      },
    ],
  },
]

/** Şablondaki geçici ikameler: asıl hareketin adı ve yerine konan egzersiz. */
export function substitutesOf(template: StarterTemplate): { exId: string; for: string }[] {
  const seen = new Set<string>()
  const out: { exId: string; for: string }[] = []
  for (const day of template.days) {
    for (const e of day.ex) {
      if (!e.subFor || seen.has(`${e.exId}|${e.subFor}`)) continue
      seen.add(`${e.exId}|${e.subFor}`)
      out.push({ exId: e.exId, for: e.subFor })
    }
  }
  return out
}

function toCfg(t: TemplateExercise, found: Exercise): ExCfg {
  const base = defaultExCfg(found)
  return {
    ...base,
    sets: t.sets,
    reps: t.reps,
    repsMax: t.repsMax,
    inc: base.timed ? 0 : t.inc,
    restSec: t.restSec,
  }
}

/** "Push" doluysa "Push (2)", o da doluysa "Push (3)": mevcut rutinlerin ve aynı gruptakilerin adlarıyla çakışmaz. */
function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`
    if (!taken.has(candidate)) return candidate
  }
}

export interface BuiltTemplate {
  routines: Routine[]
  /** Katalogda bulunamayıp atlanan egzersiz kimlikleri (beklenmez; kütüphane değiştiyse görünür). */
  missing: string[]
}

/**
 * Şablondan yeni rutinler üretir: her biri yeni kimlikli, çakışmayan adlı, ağırlıkları boş (ilk seansta girilir).
 * Mevcut rutinlere dokunmaz; kimlik üretimi test için verilebilir.
 */
export function buildTemplateRoutines(
  template: StarterTemplate,
  byId: ReadonlyMap<string, Exercise>,
  existing: readonly Pick<Routine, 'name'>[],
  makeId: () => string = newId,
): BuiltTemplate {
  const taken = new Set(existing.map((r) => r.name))
  const missing: string[] = []
  const routines = template.days.map((day): Routine => {
    const name = uniqueName(day.name, taken)
    taken.add(name)
    const cfgs: ExCfg[] = []
    for (const t of day.ex) {
      const found = byId.get(t.exId)
      if (!found) {
        missing.push(t.exId)
        continue
      }
      cfgs.push(toCfg(t, found))
    }
    return { id: makeId(), name, ex: cfgs }
  })
  return { routines, missing }
}
