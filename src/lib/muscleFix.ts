import { MUSCLES } from './muscles.ts'

/** Kullanıcının bir egzersiz için yaptığı kas düzeltmesi: kütüphanedeki (ya da özel) kayıt yerine geçer. */
export interface MuscleFix {
  primary: string[]
  secondary: string[]
}

const VALID: ReadonlySet<string> = new Set(MUSCLES)

/** Geçerli kas kimliklerini tekilleştirir ve `MUSCLES` sırasına dizer (aynı seçim hep aynı diziyi verir). */
function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const picked = new Set(raw.filter((m): m is string => typeof m === 'string' && VALID.has(m)))
  return MUSCLES.filter((m) => picked.has(m))
}

/**
 * Ham düzeltmeyi temizler: bilinmeyen kaslar atılır, ikincil listeden birincil olanlar çıkarılır.
 * En az bir geçerli birincil kas yoksa undefined döner (kas haritası boş kalan egzersiz anlamsızdır).
 */
export function normalizeMuscleFix(raw: { primary?: unknown; secondary?: unknown }): MuscleFix | undefined {
  const primary = cleanList(raw.primary)
  if (primary.length === 0) return undefined
  const own = new Set(primary)
  return { primary, secondary: cleanList(raw.secondary).filter((m) => !own.has(m)) }
}

export function sameMuscleFix(a: MuscleFix, b: MuscleFix): boolean {
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((m, i) => m === y[i])
  return eq(a.primary, b.primary) && eq(a.secondary, b.secondary)
}

/** Düzeltme uygulanmış egzersiz: kaslar yenisi, `original` düzeltmeden önceki hâli. */
export type WithMuscleFix<T> = T & { original?: MuscleFix }

/**
 * Egzersize düzeltmeyi uygular. Düzeltme yoksa aynı nesne döner (referans değişmez, gereksiz yeniden
 * hesap olmaz). Düzeltme varsa kaslar onunkiyle değişir ve eski değerler `original`'de saklanır.
 */
export function applyMuscleFix<T extends { primaryMuscles: string[]; secondaryMuscles: string[] }>(
  ex: T,
  fix: MuscleFix | undefined,
): WithMuscleFix<T> {
  if (!fix) return ex
  return {
    ...ex,
    primaryMuscles: fix.primary,
    secondaryMuscles: fix.secondary,
    original: { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles },
  }
}
