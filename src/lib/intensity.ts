import type { SetEntry } from '../store/schema.ts'
import { deriveSet } from './sets.ts'

/** Isınma rampası: çalışma ağırlığının yüzdesi ve tekrarı; 4'ten sonrası sonuncuyu tekrarlar. */
const WARMUP_PCT = [0.4, 0.6, 0.8, 0.85]
const WARMUP_REPS = [8, 5, 3, 2]
export const MAX_WARMUPS = 4
export const MAX_DROPS = 3
export const DROP_FACTOR = 0.8
/** Isınma setinden sonra kısa dinlenme (sn). */
export const WARMUP_REST_SEC = 45

/** Yük yuvarlama: hafif ağırlıklarda 1, ağırlarda 2,5 kg adım (kg cinsinden). */
export function roundLoad(kg: number): number {
  if (kg <= 0) return 0
  const step = kg < 20 ? 1 : 2.5
  return Math.max(step, Math.round(kg / step) * step)
}

/** `index`'inci (0'dan) ısınma seti; çalışma ağırlığı 0 ise ağırlık da 0 kalır. */
export function warmupSet(workWeight: number, index: number): SetEntry {
  const k = Math.min(index, WARMUP_PCT.length - 1)
  return { w: roundLoad(workWeight * WARMUP_PCT[k]), r: WARMUP_REPS[k], done: false, warmup: true }
}

export function warmupSets(workWeight: number, count: number): SetEntry[] {
  return Array.from({ length: Math.min(Math.max(0, Math.floor(count)), MAX_WARMUPS) }, (_, i) =>
    warmupSet(workWeight, i),
  )
}

/** `prev` setinin hemen ardından gelecek dropset: %80 ağırlık, aynı tekrar hedefi, tamamlanmamış. */
export function dropSet(prev: SetEntry): SetEntry {
  const base: SetEntry = { w: roundLoad(prev.w * DROP_FACTOR), r: prev.r, done: false, drop: true }
  if (!prev.sides) return base
  return deriveSet({
    ...base,
    sides: { L: { r: prev.sides.L.r, done: false }, R: { r: prev.sides.R.r, done: false } },
  })
}

export type SetKind = 'work' | 'warmup' | 'drop'

export interface SetMeta {
  kind: SetKind
  /** Erişilebilir ad ve alan etiketi öneki: "Set 2", "Isınma 1", "Drop 1". */
  name: string
  /** Satırın solundaki kısa işaret. */
  badge: string
  /** "↓ Drop" eklenebilir mi: drop zincirinin son halkası ve zincir sınırının altında. */
  canDrop: boolean
}

/** Sıralı setleri çalışma / ısınma / drop olarak numaralandırır ve drop eklenebilirliğini belirler. */
export function describeSets(sets: SetEntry[]): SetMeta[] {
  let work = 0
  let warm = 0
  let drop = 0
  let chain = 0 // ardışık drop sayısı (zincirin uzunluğu)
  return sets.map((s, i) => {
    const kind: SetKind = s.warmup ? 'warmup' : s.drop ? 'drop' : 'work'
    chain = kind === 'drop' ? chain + 1 : 0
    const isChainEnd = !sets[i + 1]?.drop
    const canDrop = kind !== 'warmup' && isChainEnd && chain < MAX_DROPS
    if (kind === 'work') return { kind, name: `Set ${++work}`, badge: String(work), canDrop }
    if (kind === 'warmup') return { kind, name: `Isınma ${++warm}`, badge: 'Is', canDrop }
    return { kind, name: `Drop ${++drop}`, badge: '↓', canDrop }
  })
}

/**
 * `index`'inci set bitince kaç saniye dinlenilecek; null = sayaç başlatma.
 * Ardından dropset geliyorsa dinlenmeden devam edilir; ısınma sonrası dinlenme kısadır.
 */
export function restAfterSec(sets: SetEntry[], index: number, restSec: number): number | null {
  if (sets[index + 1]?.drop) return null
  return sets[index]?.warmup ? Math.min(restSec, WARMUP_REST_SEC) : restSec
}

/** `last` setinden başlayarak `count` dropset zinciri (her biri bir öncekinin %80'i). */
export function dropChain(last: SetEntry, count: number): SetEntry[] {
  const out: SetEntry[] = []
  let prev = last
  for (let i = 0; i < Math.min(Math.max(0, Math.floor(count)), MAX_DROPS); i++) {
    prev = dropSet(prev)
    out.push(prev)
  }
  return out
}
