import type { Workout, WorkoutEntry } from '../store/schema.ts'
import { effectiveLoad } from './load.ts'
import { estimate1RM } from './onerm.ts'

/**
 * Antrenman geneli toparlanma molası (deload) ÖNERİSİ. Kural kullanıcının kendi notundan gelir: birden
 * fazla egzersizde performans art arda iki seans belirgin düşüyorsa (ve toparlanma da kötüyse) 5–7 gün
 * set sayısını %40–50 azaltmayı düşün. Toparlanma ölçülemediği için bu yalnızca yumuşak bir öneridir,
 * hiçbir şeyi otomatik değiştirmez; eşikler tanı değil, pratik izleme eşikleridir.
 */

/** Bir egzersizin "düşüşte" sayılması için gereken en az seans sayısı: son 2 + karşılaştırma için en az 2. */
export const MIN_SESSIONS = 4

/** Son iki seansın karşılaştırıldığı, onlardan önceki en fazla kaç seans (yakın geçmiş penceresi). */
export const REFERENCE_SESSIONS = 4

/** Karşılaştırma seansları, son seanstan en fazla bu kadar gün öncesine kadar sayılır (uzun aradan sonraki dönüşü düşüş sanma). */
export const REFERENCE_SPAN_DAYS = 90

/** Son seans bundan eskiyse egzersiz yok sayılır: düşüş "şimdi" yaşanıyor olmalı. */
export const RECENT_DAYS = 14

/** Son iki seansın ikisi de önceki en iyinin bu oranına eşit ya da altındaysa düşüş "belirgin"dir (plato eşiğiyle aynı: %95). */
export const DROP_RATIO = 0.95

/** Öneri için düşüşte olması gereken en az egzersiz sayısı ("birden fazla"). */
export const MIN_DECLINING = 2

/** Bir seansın tüm çalışma setlerinde RIR bu değerde ya da üstündeyse seans bilinçli hafif sayılır. */
export const EASY_RIR = 4

/** Susturma süresi (gün): "Şimdi değil" önerisi bu kadar gün gizler. */
export const DELOAD_SNOOZE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export interface DeloadHint {
  /** Düşüşteki egzersizlerin exId'leri (son seansı en yeni olandan başlayarak). */
  exercises: string[]
}

interface Session {
  /** Seans günü, yerel gece yarısı (epoch ms). */
  day: number
  /** Çalışma setlerinin en iyi tahmini 1RM'i (kg). */
  e1rm: number
  /** Tüm çalışma setlerinde RIR kaydı var ve EASY_RIR ya da üstünde mi (bilinçli hafif plan). */
  easy: boolean
}

/** YYYY-MM-DD'yi yerel gün başlangıcına çevirir; bozuk değerde NaN. */
function dayStart(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).getTime()
}

/**
 * Egzersiz kaydından seans özeti. Isınma, dropset ve tamamlanmamış/yarım setler sayılmaz (dropset hafif
 * ve çok tekrarlı olduğundan tahmini 1RM'i bozabilir). Vücut ağırlığı egzersizinde yük etkin yüktür
 * (`effectiveLoad`). Süreli (`timed`) ve mesafe (`distance`) egzersizi ve geçerli set yoksa undefined.
 */
function sessionOf(workout: Workout, entry: WorkoutEntry): Session | undefined {
  // Süreli ve mesafe egzersizi 1RM'siz ölçülür; düşüş sinyali olarak sayılmaz.
  if (entry.timed || entry.distance) return undefined
  const sets = entry.sets.filter((s) => s.done && !s.warmup && !s.drop)
  if (sets.length === 0) return undefined
  const e1rm = Math.max(...sets.map((s) => estimate1RM(effectiveLoad(entry, s.w), s.r)))
  const day = dayStart(workout.d)
  if (!(e1rm > 0) || Number.isNaN(day)) return undefined
  return { day, e1rm, easy: sets.every((s) => s.rir !== undefined && s.rir >= EASY_RIR) }
}

/** Egzersiz düşüşte mi? `sessions` eski→yeni sıralıdır. */
function isDeclining(sessions: Session[], now: number): boolean {
  if (sessions.length < MIN_SESSIONS) return false
  const last = sessions[sessions.length - 1]
  const prev = sessions[sessions.length - 2]
  if (now - last.day > RECENT_DAYS * DAY_MS) return false
  // Son iki seans zaten bilinçli hafifse (ör. kullanıcı molayı başlatmış) yeni bir öneri anlamsızdır.
  if (last.easy && prev.easy) return false

  const reference = sessions
    .slice(0, -2)
    .slice(-REFERENCE_SESSIONS)
    .filter((s) => last.day - s.day <= REFERENCE_SPAN_DAYS * DAY_MS)
  if (reference.length < MIN_SESSIONS - 2) return false
  const best = Math.max(...reference.map((s) => s.e1rm))
  const limit = best * DROP_RATIO + 1e-9 // kayan nokta payı: tam %95 düşüş sınırda kalmasın
  return last.e1rm <= limit && prev.e1rm <= limit
}

/**
 * `workouts` eski→yeni sıralıdır. En az MIN_DECLINING egzersiz düşüşteyse öneri döner, aksi hâlde undefined.
 *
 * Bilinen sınır: rutinin planlı ağırlığı seansta saklanmadığı için "bilerek hafif plan" yalnız RIR
 * kayıtlarından (tüm setlerde RIR ≥ 4) anlaşılır; RIR girmeden bilerek hafif çalışılan iki seans düşüş sayılabilir.
 */
export function detectDeload(workouts: Workout[], now: number): DeloadHint | undefined {
  const byExercise = new Map<string, Session[]>()
  for (const wk of workouts) {
    for (const entry of wk.entries) {
      const session = sessionOf(wk, entry)
      if (!session) continue
      const list = byExercise.get(entry.exId)
      if (list) list.push(session)
      else byExercise.set(entry.exId, [session])
    }
  }

  const declining: Array<{ exId: string; day: number }> = []
  for (const [exId, sessions] of byExercise) {
    if (isDeclining(sessions, now)) declining.push({ exId, day: sessions[sessions.length - 1].day })
  }
  if (declining.length < MIN_DECLINING) return undefined
  declining.sort((a, b) => b.day - a.day)
  return { exercises: declining.map((d) => d.exId) }
}

/** Öneri susturulmuş mu? */
export function isDeloadSnoozed(snoozedUntil: number | undefined, now: number): boolean {
  return snoozedUntil !== undefined && snoozedUntil > now
}

/** "Şimdi değil"e basılınca yazılacak susturma sonu (epoch ms). */
export function deloadSnoozeUntil(now: number): number {
  return now + DELOAD_SNOOZE_DAYS * DAY_MS
}

/** Deload haftasında çalışma setleri bu oranlar arasında azaltılır (%40–50); ağırlık aynı kalır. */
export const DELOAD_SET_CUT_MIN = 0.4
export const DELOAD_SET_CUT_MAX = 0.5

/** "%40–50": öneri metinleri sabitlerle aynı kalsın diye. */
export function deloadCutText(): string {
  return `%${Math.round(DELOAD_SET_CUT_MIN * 100)}–${Math.round(DELOAD_SET_CUT_MAX * 100)}`
}

/** Deload'da önerilen RIR aralığı ("4–5"): bilinçli hafif seans eşiğinden (EASY_RIR) başlar. */
export function deloadRirText(): string {
  return `${EASY_RIR}–${EASY_RIR + 1}`
}

/**
 * Deload haftasında önerilen çalışma seti sayısı: setlerin en az yarısı kalır (en çok %50 azalma, yukarı
 * yuvarlanır), en az 1. Ağırlık değişmez: ilerleme kuralı bir sonraki seansı son seansın yükünden kurar,
 * ağırlığı düşürmek deload sonrası planı da düşürürdü; eksik set ise ilerlemeyi yalnız bir seans bekletir.
 */
export function deloadSetCount(sets: number): number {
  if (sets <= 0) return 0
  return Math.max(1, Math.ceil(sets * (1 - DELOAD_SET_CUT_MAX)))
}
