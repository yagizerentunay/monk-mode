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

/** Uygulamanın varsayılan tahmini: Epley. */
export const estimate1RM = epley
