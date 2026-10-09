import type { Workout } from '../store/schema.ts'
import type { Exercise } from './exercises.ts'
import type { MuscleId } from './muscles.ts'

/** Bir kas için en çok kaç egzersiz önerilir. */
export const MAX_SUGGESTIONS = 5

/**
 * Öneriye giren kategoriler: set/tekrarla yapılan güç egzersizleri. Germe, kardiyo, pliometrik ve teknik
 * olimpik kaldırışlar rutine "3×8" diye eklenecek şeyler değildir. (Kullanıcının daha önce yaptığı egzersiz
 * kategoriden bağımsız önerilir.)
 */
const SUGGEST_CATEGORIES: ReadonlySet<string> = new Set(['strength', 'powerlifting'])

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 }

export interface Suggestion {
  ex: Exercise
  /** Kaç antrenmanda en az bir sert set yapıldı (0 = daha önce yapılmamış). */
  timesDone: number
}

interface Past {
  count: number
  /** Son yapıldığı gün (YYYY-MM-DD). */
  last: string
}

/** Egzersiz başına, en az bir tamamlanmış çalışma seti (ısınma hariç) olan antrenman sayısı ve son gün. */
function pastOf(workouts: Workout[]): Map<string, Past> {
  const out = new Map<string, Past>()
  for (const w of workouts) {
    const seen = new Set<string>()
    for (const e of w.entries) {
      if (seen.has(e.exId) || !e.sets.some((s) => s.done && !s.warmup)) continue
      seen.add(e.exId)
      const cur = out.get(e.exId)
      out.set(e.exId, { count: (cur?.count ?? 0) + 1, last: cur && cur.last > w.d ? cur.last : w.d })
    }
  }
  return out
}

/** Yerel ayardan bağımsız, her ortamda aynı sonucu veren karşılaştırma. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Kas için egzersiz önerisi: kasın BİRİNCİL kas olduğu egzersizler (`exercises` kas düzeltmeleri uygulanmış
 * liste olmalı, bkz. useExercises). Sıra:
 *  1. Kullanıcının daha önce yaptıkları: çok yapılandan başlayarak (eşitlikte yakın zamanda yapılan, sonra ad).
 *  2. Kalan yer için yapılmamışlar, ekipman çeşitliliğini gözeterek: her adımda şu ana kadar en az seçilmiş
 *     ekipmandan, eşitlikte kütüphanede daha yaygın ekipmandan, sonra kolay seviyeden ve ada göre seçilir.
 * Girdi sırasına bağlı değildir: aynı veri her zaman aynı çıktıyı verir. Girdileri değiştirmez.
 */
export function suggestExercises(
  muscle: MuscleId,
  exercises: Exercise[],
  workouts: Workout[],
  limit: number = MAX_SUGGESTIONS,
): Suggestion[] {
  const max = Math.max(0, Math.floor(limit) || 0)
  const past = pastOf(workouts)
  const forMuscle = exercises.filter((e) => e.primaryMuscles.includes(muscle))

  const used = forMuscle
    .filter((e) => past.has(e.id))
    .sort((a, b) => {
      const pa = past.get(a.id)!
      const pb = past.get(b.id)!
      return pb.count - pa.count || cmp(pb.last, pa.last) || cmp(a.name, b.name) || cmp(a.id, b.id)
    })
    .slice(0, max)
  const picked: Suggestion[] = used.map((ex) => ({ ex, timesDone: past.get(ex.id)!.count }))

  const pool = forMuscle.filter((e) => !past.has(e.id) && (e.custom || SUGGEST_CATEGORIES.has(e.category)))
  const key = (e: Exercise) => e.equipment ?? ''
  const common = new Map<string, number>()
  for (const e of pool) common.set(key(e), (common.get(key(e)) ?? 0) + 1)
  const chosen = new Map<string, number>()
  for (const s of picked) chosen.set(key(s.ex), (chosen.get(key(s.ex)) ?? 0) + 1)

  const rest = [...pool]
  while (picked.length < max && rest.length > 0) {
    let best = 0
    for (let i = 1; i < rest.length; i++) {
      if (better(rest[i], rest[best], key, chosen, common)) best = i
    }
    const [ex] = rest.splice(best, 1)
    picked.push({ ex, timesDone: 0 })
    chosen.set(key(ex), (chosen.get(key(ex)) ?? 0) + 1)
  }
  return picked
}

/** `a`, `b`'den önce mi gelmeli (çeşitlilik, yaygınlık, seviye, ad, kimlik)? */
function better(
  a: Exercise,
  b: Exercise,
  key: (e: Exercise) => string,
  chosen: Map<string, number>,
  common: Map<string, number>,
): boolean {
  const ka = key(a)
  const kb = key(b)
  const d =
    (chosen.get(ka) ?? 0) - (chosen.get(kb) ?? 0) ||
    (common.get(kb) ?? 0) - (common.get(ka) ?? 0) ||
    cmp(ka, kb) ||
    (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3) ||
    cmp(a.name, b.name) ||
    cmp(a.id, b.id)
  return d < 0
}
