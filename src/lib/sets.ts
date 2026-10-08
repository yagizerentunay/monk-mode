import type { SetEntry, SideSet } from '../store/schema.ts'

export type Side = 'L' | 'R'
export const SIDES: Side[] = ['L', 'R']

export function makeSides(r: number, done = false): { L: SideSet; R: SideSet } {
  return { L: { r, done }, R: { r, done } }
}

/**
 * Tek taraflı setin türetilmiş alanlarını yeniden hesaplar: `r` zayıf tarafın tekrarı,
 * `done` iki tarafın da tamamlanmış olması. Tek taraflı değilse set aynen döner.
 * Böylece 1RM, progression ve PR mantığı sol+sağ toplamı yerine taraf başına tekrarı görür.
 */
export function deriveSet(set: SetEntry): SetEntry {
  if (!set.sides) return set
  const { L, R } = set.sides
  return { ...set, r: Math.min(L.r, R.r), done: L.done && R.done }
}

/** Setteki toplam tekrar (hacim için): tek taraflıda sol + sağ. */
export function setReps(set: SetEntry): number {
  return set.sides ? set.sides.L.r + set.sides.R.r : set.r
}

/** Isınma setleri tek satırlı kalır; sol/sağ ayrımı yalnız çalışma ve drop setlerinde anlamlıdır. */
export function toUnilateral(sets: SetEntry[]): SetEntry[] {
  return sets.map((s) => (s.sides || s.warmup ? s : { ...s, sides: makeSides(s.r, s.done) }))
}

export function toBilateral(sets: SetEntry[]): SetEntry[] {
  return sets.map((s) => {
    if (!s.sides) return s
    const { sides: _sides, ...rest } = deriveSet(s)
    return rest
  })
}

/** Kısa özet: `60×8 @2`, tek taraflıda `20×L10/R8 @1`, dropsette başına `↓`. */
export function formatSet(set: SetEntry, weight: string): string {
  const reps = set.sides ? `L${set.sides.L.r}/R${set.sides.R.r}` : String(set.r)
  const half = set.partial ? ' (yarım)' : ''
  return `${set.drop ? '↓' : ''}${weight}×${reps}${set.rir !== undefined ? ` @${set.rir}` : ''}${half}`
}
