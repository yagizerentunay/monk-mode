import type { Unit } from './units.ts'

/** Eldeki bar ve plaka çeşitleri. Değerler kitin ait olduğu birimdedir (kg kiti kg, lb kiti lb). */
export interface PlateKit {
  bar: number
  /** Taraf başına her çeşitten sınırsız adet varsayılır. */
  plates: number[]
}

/** Ayarlarda seçilebilen yaygın plaka çeşitleri. */
export const PLATE_CHOICES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lb: [45, 35, 25, 10, 5, 2.5, 1.25],
}

export const DEFAULT_KITS: Record<Unit, PlateKit> = {
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lb: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
}

export interface PlateCount {
  plate: number
  count: number
}

export interface PlateResult {
  /** Bir tarafa takılacak plakalar, ağırdan hafife. */
  perSide: PlateCount[]
  /** Barın ve plakaların gerçek toplamı; hedefi aşmaz. */
  loaded: number
  /** Hedefe kalan fark: eldeki plakalarla tutturulamayan kısım (iki taraf toplamı). */
  short: number
  /** Hedef barın kendisinden hafif. */
  belowBar: boolean
}

/** Makul olmayan hedefler (yazım hatası) hesabı şişirmesin. */
const MAX_TARGET = 1500
/** Kayan nokta hatasından kaçınmak için hesap bu çarpanla tam sayıda yapılır. */
const SCALE = 1000

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

const round3 = (v: number) => Math.round(v * SCALE) / SCALE

/**
 * Hedef toplam ağırlığı bar + iki yana simetrik plakalarla oluşturur. Eldeki plakalarla tam
 * tutmuyorsa hedefi aşmayan en yakın yükü seçer; aynı yükte en az plakayı tercih eder (25+15, 20+20
 * gibi eşitlikte ağır plaka önce). Açgözlü yerine sınırsız-adet para problemi çözülür, çünkü
 * örneğin {25, 20} ile 40 kg/taraf yalnız 20+20 ile tutar.
 */
export function platesFor(target: number, kit: PlateKit): PlateResult {
  const { bar } = kit
  if (!(target >= bar)) return { perSide: [], loaded: bar, short: 0, belowBar: true }

  const sizes = [...new Set(kit.plates.filter((p) => Number.isFinite(p) && p > 0))]
    .map((p) => Math.round(p * SCALE))
    .sort((a, b) => b - a)
  const capped = Math.min(target, MAX_TARGET)
  const budget = Math.floor(((capped - bar) / 2) * SCALE + 1e-6)
  if (sizes.length === 0 || budget <= 0) {
    return { perSide: [], loaded: bar, short: round3(target - bar), belowBar: false }
  }

  // Tüm plakalar ortak bir adımın katıdır; durumları bu adımla say (çoğu kitte 250 → <=6000 durum).
  const step = sizes.reduce(gcd)
  const n = Math.floor(budget / step)
  const unit = sizes.map((s) => s / step)

  // count[a] = a adımlık yükü yapan en az plaka sayısı; from[a] = son eklenen plaka.
  const count = new Array<number>(n + 1).fill(Infinity)
  const from = new Array<number>(n + 1).fill(-1)
  count[0] = 0
  for (let a = 1; a <= n; a++) {
    for (let i = 0; i < unit.length; i++) {
      const prev = a - unit[i]
      if (prev >= 0 && count[prev] + 1 < count[a]) {
        count[a] = count[prev] + 1
        from[a] = i
      }
    }
  }

  let best = n
  while (best > 0 && !Number.isFinite(count[best])) best--

  const tally = new Map<number, number>()
  for (let a = best; a > 0; a -= unit[from[a]]) {
    const size = sizes[from[a]]
    tally.set(size, (tally.get(size) ?? 0) + 1)
  }
  const perSide = [...tally]
    .sort((x, y) => y[0] - x[0])
    .map(([size, c]) => ({ plate: size / SCALE, count: c }))

  const loaded = round3(bar + 2 * best * step / SCALE)
  return { perSide, loaded, short: round3(target - loaded), belowBar: false }
}

/**
 * Seans ekranında egzersizin setlerinden hesaplayıcıya verilecek ağırlıklar (kg): tekil ve artan
 * sırada hızlı seçim listesi, ve açılışta seçili olacak ağırlık (sıradaki yapılmamış set, yoksa en ağır).
 */
export function plateTargets(sets: { w: number; done: boolean }[]): { weights: number[]; initial: number } {
  const weights = [...new Set(sets.map((s) => s.w).filter((w) => w > 0))].sort((a, b) => a - b)
  const next = sets.find((s) => !s.done && s.w > 0)
  return { weights, initial: next?.w ?? weights[weights.length - 1] ?? 0 }
}

/** "2 × 20 + 1.25" biçiminde kısa gösterim; boş liste için null. */
export function formatPlates(perSide: PlateCount[]): string | null {
  if (perSide.length === 0) return null
  return perSide.map((p) => (p.count > 1 ? `${p.count} × ${p.plate}` : String(p.plate))).join(' + ')
}
