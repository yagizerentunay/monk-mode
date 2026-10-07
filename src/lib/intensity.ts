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
