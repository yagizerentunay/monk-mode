import { MUSCLES, targetFor, type MuscleId, type MuscleTargets, type WeekComparison } from './muscles.ts'

export interface WeekRow {
  muscle: MuscleId
  /** Bu hafta, haftanın başından bugüne. */
  sets: number
  lastWeek: number
  /** sets - lastWeek. */
  delta: number
  /** Haftalık hedef (set); 0 = bu kasa hedef yok. */
  target: number
  /** Hedefi olup henüz ona ulaşmamış (hafta bitmediği için "eksik" değil, ilerleme). */
  below: boolean
}

/**
 * "Bu hafta" listesinin satırları: bu ya da geçen hafta çalışılmış kaslar ve hedefi olan (0'dan büyük) kaslar,
 * hiç çalışılmamış olsalar bile. Hedefi 0 olup iki haftada da çalışılmamış kaslar `hidden`'dadır.
 * Sıra: bu hafta çok olan önce, eşitlikte geçen hafta çok olan, sonra `MUSCLES` sırası (deterministik).
 */
export function weekRows(
  cmp: Pick<WeekComparison, 'thisWeek' | 'lastWeek' | 'delta'>,
  targets: MuscleTargets | undefined,
): { rows: WeekRow[]; hidden: MuscleId[] } {
  const rows: WeekRow[] = []
  const hidden: MuscleId[] = []
  for (const m of MUSCLES) {
    const target = targetFor(targets, m)
    const sets = cmp.thisWeek[m]
    if (sets > 0 || cmp.lastWeek[m] > 0 || target > 0) {
      rows.push({ muscle: m, sets, lastWeek: cmp.lastWeek[m], delta: cmp.delta[m], target, below: target > 0 && sets < target })
    } else {
      hidden.push(m)
    }
  }
  // Array.prototype.sort kararlıdır: eşitlikte MUSCLES sırası kalır.
  rows.sort((a, b) => b.sets - a.sets || b.lastWeek - a.lastWeek)
  return { rows, hidden }
}

/** 6,5 gibi: tam sayıda ondalık yok, ondalık ayracı virgül. */
export function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

/** Geçen haftaya göre fark: "+3", "−2", "+0,5"; fark yoksa "=". */
export function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10
  if (r === 0) return '='
  return r > 0 ? `+${fmt(r)}` : `−${fmt(-r)}`
}
