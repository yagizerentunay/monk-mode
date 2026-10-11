import type { ExCfg, ProgressionRule, SetEntry, WorkoutEntry } from '../store/schema.ts'

export interface Prescription {
  /** Önerilen çalışma ağırlığı (kg). */
  w: number
  /** Önerilen hedef tekrar. */
  r: number
  /** Bu öneriyi doğuran gerekçe, arayüzde ipucu olarak gösterilir. */
  reason: 'plan' | 'increase' | 'repeat' | 'add-rep' | 'confirm' | 'need-rir'
}

/** Önerinin kısa Türkçe ipucu; `plan` ve `repeat` ek açıklama gerektirmez. */
export const REASON_HINT: Partial<Record<Prescription['reason'], string>> = {
  increase: 'Ağırlık artışı: iki seans üst sınırda kaldın',
  'add-rep': 'Bir tekrar ekle',
  confirm: 'Bir seans daha üst sınırda kalırsan ağırlığı artır',
  'need-rir': 'Artış için RIR gir (en az 2)',
}

/** Artış için her çalışma setinde istenen en düşük RIR (kullanıcının koçluk kuralı). */
export const MIN_RIR = 2

export interface PrescribeOptions {
  /** `last`ten önceki karşılaştırılabilir kayıt; temkinli kuralda onay seansı olarak aranır. */
  prev?: WorkoutEntry
  /** Ayarlardaki kural; undefined = 'cautious'. */
  rule?: ProgressionRule
}

/** İlerleme yalnız asıl çalışma setlerine bakar: ısınma ve dropsetler hedefi tutmak zorunda değildir. */
function workSets(entry: WorkoutEntry): SetEntry[] {
  return entry.sets.filter((s) => !s.warmup && !s.drop)
}

/** Seans, hedeflenen tüm çalışma setlerini tamamladı mı? */
function completedAll(entry: WorkoutEntry, targetSets: number): boolean {
  const sets = workSets(entry)
  return sets.length >= targetSets && sets.every((s) => s.done)
}

type TopStatus = 'miss' | 'no-rir' | 'ok'

/**
 * Seans "üst sınırda mıydı?": tüm hedef çalışma setleri yapılmış, hepsi `top` tekrarda ve RIR'i en az
 * `MIN_RIR`. RIR'i girilmemiş set başarı sayılmaz: yalnız bu engelse 'no-rir' döner ki arayüz "RIR gir" desin.
 */
function topStatus(entry: WorkoutEntry, targetSets: number, top: number): TopStatus {
  const sets = workSets(entry).filter((s) => s.done)
  if (sets.length === 0 || !completedAll(entry, targetSets)) return 'miss'
  if (!sets.every((s) => s.r >= top)) return 'miss'
  if (sets.some((s) => s.rir !== undefined && s.rir < MIN_RIR)) return 'miss'
  return sets.some((s) => s.rir === undefined) ? 'no-rir' : 'ok'
}

/** İki seans karşılaştırılabilir mi: aynı çalışma seti sayısı ve aynı üst çalışma yükü. */
function sameLoadAndSets(a: WorkoutEntry, b: WorkoutEntry): boolean {
  const sa = workSets(a).filter((s) => s.done)
  const sb = workSets(b).filter((s) => s.done)
  if (sa.length === 0 || sa.length !== sb.length) return false
  return Math.max(...sa.map((s) => s.w)) === Math.max(...sb.map((s) => s.w))
}

/**
 * Bir sonraki seansın önerisi. Geçmişten türetilir, saklanmaz.
 * `last`, aynı egzersizin son tamamlanmış kaydıdır (yoksa plan kullanılır).
 *
 * Kural 'fast': tek seans üst sınırı tutturunca ağırlık artar. Kural 'cautious' (varsayılan): artış için
 * `last` ve `opts.prev` aynı yükte, aynı set sayısında, üst sınırda ve her sette RIR ≥ 2 olmalıdır;
 * biri eksikse ağırlık korunur ('confirm': bir seans daha, 'need-rir': RIR girilmemiş). Artıştan sonra
 * hedef tekrar aralığın altına döner.
 */
export function nextPrescription(cfg: ExCfg, last?: WorkoutEntry, opts: PrescribeOptions = {}): Prescription {
  const plan: Prescription = { w: cfg.weight, r: cfg.reps, reason: 'plan' }
  if (!last || cfg.prog === 'off') return plan

  const sets = workSets(last).filter((s) => s.done)
  if (sets.length === 0) return plan

  const lastW = Math.max(...sets.map((s) => s.w))
  const allDone = completedAll(last, cfg.sets)
  const linear = cfg.prog === 'linear'
  // linear: hedef tekrar üst sınırdır; double: aralığın üstü.
  const top = linear ? cfg.reps : Math.max(cfg.repsMax, cfg.reps)
  const increase: Prescription = { w: lastW + cfg.inc, r: cfg.reps, reason: 'increase' }

  if (opts.rule === 'fast') {
    if (allDone && sets.every((s) => s.r >= top)) return increase
  } else {
    const status = topStatus(last, cfg.sets, top)
    if (status === 'no-rir') return { w: lastW, r: top, reason: 'need-rir' }
    if (status === 'ok') {
      const prev = opts.prev
      if (!prev || !sameLoadAndSets(last, prev)) return { w: lastW, r: top, reason: 'confirm' }
      const prevStatus = topStatus(prev, cfg.sets, top)
      if (prevStatus === 'ok') return increase
      return { w: lastW, r: top, reason: prevStatus === 'no-rir' ? 'need-rir' : 'confirm' }
    }
  }

  if (linear) return { w: lastW, r: cfg.reps, reason: 'repeat' }
  // double progression: aralıkta önce tekrar ekle.
  const minReps = Math.min(...sets.map((s) => s.r))
  if (allDone && minReps < top) return { w: lastW, r: Math.min(minReps + 1, top), reason: 'add-rep' }
  // Üst sınırda ama RIR < 2: tekrar eklenecek yer yok, aynı hedefle tekrar.
  if (allDone) return { w: lastW, r: top, reason: 'repeat' }
  return { w: lastW, r: Math.max(minReps, cfg.reps), reason: 'repeat' }
}
