/** Tahmini tek tekrar maksimumu (1RM). 12 tekrarın üstünde formüller güvenilmez olduğundan tavan uygulanır. */
const MAX_REPS = 12

function clampReps(reps: number): number {
  return Math.min(Math.floor(reps), MAX_REPS)
}

export function epley(weight: number, reps: number): number {
  const r = clampReps(reps)
  if (weight <= 0 || r <= 0) return 0
  if (r === 1) return weight
  return weight * (1 + r / 30)
}

export function brzycki(weight: number, reps: number): number {
  const r = clampReps(reps)
  if (weight <= 0 || r <= 0) return 0
  if (r === 1) return weight
  return (weight * 36) / (37 - r)
}

/** RIR'den en fazla bu kadar tekrar sayılır: sınırdan uzak setlerde RIR tahmini güvenilmez ve şişirir. */
export const MAX_RIR_CREDIT = 3

/**
 * Uygulamanın varsayılan tahmini: Epley. RIR girilmişse set, tükenişe kadar yapılabilecek tekrarla
 * (`reps + rir`, en çok MAX_RIR_CREDIT) hesaplanır; böylece RIR 3'te 5 tekrar, RIR 0'da 5 tekrardan yüksek
 * sayılır. RIR yoksa ya da geçersizse yalnız yapılan tekrar sayılır (eski hesap).
 */
export function estimate1RM(weight: number, reps: number, rir?: number): number {
  if (Math.floor(reps) <= 0) return 0
  const credit = rir !== undefined && Number.isFinite(rir) ? Math.min(Math.max(Math.floor(rir), 0), MAX_RIR_CREDIT) : 0
  return epley(weight, Math.floor(reps) + credit)
}
