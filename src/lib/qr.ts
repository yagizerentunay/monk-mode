/**
 * Bağımlılıksız, küçük QR kodlayıcı (ISO/IEC 18004, yalnız bayt kipi). Rutin paylaşım linkini QR'a çevirir;
 * dış istek ya da kütüphane gerekmez. Önce M (orta) hata düzeltme denenir, sığmazsa L (düşük).
 * Algoritmanın yapısı Project Nayuki'nin QR Code generator kütüphanesini (MIT) izler.
 */

/** Ekrandan okutulabilir kalsın diye en büyük sürüm (117×117 modül, M düzeyinde ~1000 bayt). */
export const MAX_QR_VERSION = 25

type Ecl = 'L' | 'M'

const ECC_PER_BLOCK: Record<Ecl, readonly number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
}
const NUM_BLOCKS: Record<Ecl, readonly number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
}
const FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0 }

/** Sürümdeki veri + hata düzeltme modülü sayısı (bit). */
function rawModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (ver >= 7) result -= 36
  }
  return result
}

const dataCodewords = (ver: number, ecl: Ecl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver]

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((d, i) => (result[i] ^= gfMul(d, factor)))
  }
  return result
}

/** Veri kod sözcüklerini bloklara böler, hata düzeltmeyi ekler ve iç içe geçirir. */
function addEcc(data: readonly number[], ver: number, ecl: Ecl): number[] {
  const numBlocks = NUM_BLOCKS[ecl][ver]
  const eccLen = ECC_PER_BLOCK[ecl][ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0)
    blocks.push([...dat, ...ecc])
  }
  const out: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(b[i])
    })
  }
  return out
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return []
  const num = Math.floor(ver / 7) + 2
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2
  const result = [6]
  for (let pos = ver * 4 + 17 - 7; result.length < num; pos -= step) result.splice(1, 0, pos)
  return result
}

const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

class Matrix {
  readonly ver: number
  readonly size: number
  readonly dark: boolean[][]
  readonly fixed: boolean[][]

  constructor(ver: number) {
    this.ver = ver
    this.size = ver * 4 + 17
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }

  set(x: number, y: number, dark: boolean) {
    this.dark[y][x] = dark
    this.fixed[y][x] = true
  }

  drawPatterns() {
    const n = this.size
    for (let i = 0; i < n; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx
          const y = cy + dy
          const dist = Math.max(Math.abs(dx), Math.abs(dy))
          if (x >= 0 && x < n && y >= 0 && y < n) this.set(x, y, dist !== 2 && dist !== 4)
        }
      }
    }
    const pos = alignmentPositions(this.ver)
    const last = pos.length - 1
    pos.forEach((cx, i) =>
      pos.forEach((cy, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
        }
      }),
    )
    this.drawFormat('M', 0) // yer ayırır; maske seçilince gerçek değer yazılır
    if (this.ver >= 7) {
      let rem = this.ver
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
      const bits = (this.ver << 12) | rem
      for (let i = 0; i < 18; i++) {
        const bit = ((bits >>> i) & 1) !== 0
        const a = n - 11 + (i % 3)
        const b = Math.floor(i / 3)
        this.set(a, b, bit)
        this.set(b, a, bit)
      }
    }
  }

  drawFormat(ecl: Ecl, mask: number) {
    const data = (FORMAT_BITS[ecl] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    const n = this.size
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) this.set(n - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) this.set(8, n - 15 + i, bit(i))
    this.set(8, n - 8, true)
  }

  drawCodewords(data: readonly number[]) {
    const n = this.size
    let i = 0
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert
          if (!this.fixed[y][x] && i < data.length * 8) {
            this.dark[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) if (!this.fixed[y][x] && MASKS[mask](x, y)) this.dark[y][x] = !this.dark[y][x]
    }
  }

  /** Standarttaki dört ceza kuralı; en düşük cezalı maske seçilir. */
  penalty(): number {
    const n = this.size
    const d = this.dark
    let score = 0
    const lines: boolean[][] = [...d, ...d.map((_, x) => d.map((row) => row[x]))]
    const finder = [true, false, true, true, true, false, true]
    for (const line of lines) {
      let run = 1
      for (let i = 1; i <= n; i++) {
        if (i < n && line[i] === line[i - 1]) run++
        else {
          if (run >= 5) score += run - 2
          run = 1
        }
      }
      for (let i = 0; i + 7 <= n; i++) {
        if (!finder.every((v, k) => line[i + k] === v)) continue
        const lightBefore = i >= 4 && [1, 2, 3, 4].every((k) => !line[i - k])
        const lightAfter = i + 11 <= n && [0, 1, 2, 3].every((k) => !line[i + 7 + k])
        if (lightBefore || lightAfter) score += 40
      }
    }
    let darkCount = 0
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (d[y][x]) darkCount++
        if (x + 1 < n && y + 1 < n && d[y][x] === d[y][x + 1] && d[y][x] === d[y + 1][x] && d[y][x] === d[y + 1][x + 1]) score += 3
      }
    }
    const total = n * n
    score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10
    return score
  }
}

/**
 * Metni QR modül matrisine çevirir (`true` koyu). Sığmazsa (bkz. MAX_QR_VERSION) null döner.
 * Sessiz bölge (4 modül kenar boşluğu) matrise dahil değildir; çizen ekler.
 */
export function encodeQr(text: string, maxVersion = MAX_QR_VERSION): boolean[][] | null {
  const bytes = new TextEncoder().encode(text)
  let ver = 0
  let ecl: Ecl = 'M'
  search: for (const level of ['M', 'L'] as const) {
    for (let v = 1; v <= maxVersion; v++) {
      const countBits = v <= 9 ? 8 : 16
      if (bytes.length < 1 << countBits && 4 + countBits + bytes.length * 8 <= dataCodewords(v, level) * 8) {
        ver = v
        ecl = level
        break search
      }
    }
  }
  if (ver === 0) return null

  const bits: number[] = []
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capacity = dataCodewords(ver, ecl) * 8
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0))

  const m = new Matrix(ver)
  m.drawPatterns()
  m.drawCodewords(addEcc(data, ver, ecl))
  let best = -1
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    m.applyMask(mask)
    m.drawFormat(ecl, mask)
    const score = m.penalty()
    if (score < bestScore) {
      best = mask
      bestScore = score
    }
    m.applyMask(mask) // XOR geri alır
  }
  m.applyMask(best)
  m.drawFormat(ecl, best)
  return m.dark
}
