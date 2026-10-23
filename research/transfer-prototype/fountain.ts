// Animasyonlu QR için Luby Transform (fountain) kodu. Tarayıcı ve Node'da çalışır; bağımlılık yok.
// Çerçeve: "MM1:" + base45( başlık (14 bayt) + blok ). Başlık: k (u16), uzunluk (u32), crc (u32), tohum (u32).

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

/** RFC 9285 base45: QR'ın alfanümerik kipine sığar; bayt kipinde base64'ten daha sık paketlenir. */
export function base45Encode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const n = bytes[i] * 256 + bytes[i + 1]
      out += ALPHABET[n % 45] + ALPHABET[Math.floor(n / 45) % 45] + ALPHABET[Math.floor(n / 2025)]
    } else {
      const n = bytes[i]
      out += ALPHABET[n % 45] + ALPHABET[Math.floor(n / 45)]
    }
  }
  return out
}

export function base45Decode(text: string): Uint8Array {
  const out: number[] = []
  for (let i = 0; i < text.length; i += 3) {
    const c = [...text.slice(i, i + 3)].map((ch) => {
      const v = ALPHABET.indexOf(ch)
      if (v < 0) throw new Error('Geçersiz base45 karakteri')
      return v
    })
    const n = c[0] + c[1] * 45 + (c.length === 3 ? c[2] * 2025 : 0)
    if (c.length === 3) out.push(n >> 8, n & 255)
    else out.push(n)
  }
  return Uint8Array.from(out)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** murmur3 son karıştırması: ardışık tohumlar ilişkisiz başlangıç durumları versin. */
function mix(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** xorshift32: kodlayıcı ve çözücü aynı tohumdan aynı blok kümesini üretir. */
function rng(seed: number): () => number {
  let x = mix(seed) || 0x9e3779b9
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }
}

/** Sağlam soliton dağılımı (c = 0,1, δ = 0,05), birikimli. */
function robustSoliton(k: number): number[] {
  const c = 0.1
  const delta = 0.05
  const R = c * Math.log(k / delta) * Math.sqrt(k)
  const pivot = Math.max(1, Math.min(k, Math.floor(k / R)))
  const p = new Array<number>(k + 1).fill(0)
  for (let d = 1; d <= k; d++) {
    const rho = d === 1 ? 1 / k : 1 / (d * (d - 1))
    let tau = 0
    if (d < pivot) tau = R / (d * k)
    else if (d === pivot) tau = (R * Math.log(R / delta)) / k
    p[d] = rho + tau
  }
  const sum = p.reduce((a, b) => a + b, 0)
  let acc = 0
  return p.map((v) => (acc += v / sum))
}

/** Tohumdan seçilen blok indeksleri. Tohum < k ise sistematik çerçeve: yalnız o blok. */
export function blocksFor(seed: number, k: number, cdf: number[]): number[] {
  if (seed < k) return [seed]
  const r = rng(seed)
  const u = r()
  let degree = 1
  while (degree < k && cdf[degree] < u) degree++
  const set = new Set<number>()
  while (set.size < degree) set.add(Math.floor(r() * k))
  return [...set]
}

const HEADER = 14
const PREFIX = 'MM1:'

export interface Encoder {
  /** Blok sayısı. */
  k: number
  /** `seed` numaralı çerçevenin QR metni; seed sonsuza kadar artırılabilir. */
  frame(seed: number): string
}

export function createEncoder(data: Uint8Array, blockSize: number): Encoder {
  const k = Math.max(1, Math.ceil(data.length / blockSize))
  const blocks = Array.from({ length: k }, (_, i) => {
    const b = new Uint8Array(blockSize)
    b.set(data.subarray(i * blockSize, (i + 1) * blockSize))
    return b
  })
  const cdf = robustSoliton(k)
  const crc = crc32(data)
  return {
    k,
    frame(seed) {
      const out = new Uint8Array(HEADER + blockSize)
      const view = new DataView(out.buffer)
      view.setUint16(0, k)
      view.setUint32(2, data.length)
      view.setUint32(6, crc)
      view.setUint32(10, seed)
      for (const i of blocksFor(seed, k, cdf)) for (let j = 0; j < blockSize; j++) out[HEADER + j] ^= blocks[i][j]
      return PREFIX + base45Encode(out)
    },
  }
}

export interface Decoder {
  /** Okunan QR metnini ekler; tüm bloklar çözülüp CRC tutunca veriyi döndürür. */
  add(text: string): Uint8Array | null
  /** Çözülen blok oranı (0-1): ilerleme çubuğu için. */
  progress(): number
  /** Kabul edilen farklı çerçeve sayısı. */
  frames(): number
}

/** Peeling çözücü: tek bilinmeyeni kalan çerçeve bir bloğu çözer, o blok diğer çerçevelerden çıkarılır. */
export function createDecoder(): Decoder {
  let k = 0
  let length = 0
  let crc = 0
  let cdf: number[] = []
  let solved: (Uint8Array | null)[] = []
  let pending: { idx: Set<number>; data: Uint8Array }[] = []
  const seen = new Set<number>()
  let result: Uint8Array | null = null

  function settle(first: number, firstData: Uint8Array) {
    const queue: [number, Uint8Array][] = [[first, firstData]]
    while (queue.length) {
      const [bi, bd] = queue.pop()!
      if (solved[bi]) continue
      solved[bi] = bd
      const next: typeof pending = []
      for (const p of pending) {
        if (p.idx.has(bi)) {
          p.idx.delete(bi)
          for (let j = 0; j < bd.length; j++) p.data[j] ^= bd[j]
        }
        if (p.idx.size === 1) queue.push([[...p.idx][0], p.data])
        else if (p.idx.size > 1) next.push(p)
      }
      pending = next
    }
  }

  return {
    add(text) {
      if (result) return result
      if (!text.startsWith(PREFIX)) return null
      const bytes = base45Decode(text.slice(PREFIX.length))
      if (bytes.length <= HEADER) return null
      const view = new DataView(bytes.buffer)
      const fk = view.getUint16(0)
      const seed = view.getUint32(10)
      if (!k) {
        k = fk
        length = view.getUint32(2)
        crc = view.getUint32(6)
        cdf = robustSoliton(k)
        solved = new Array(k).fill(null)
      }
      // Başka bir aktarımın çerçevesi ya da tekrar: yok sayılır.
      if (fk !== k || view.getUint32(6) !== crc || seen.has(seed)) return null
      seen.add(seed)
      const data = bytes.slice(HEADER)
      const all = blocksFor(seed, k, cdf)
      for (const i of all) if (solved[i]) for (let j = 0; j < data.length; j++) data[j] ^= solved[i]![j]
      const idx = new Set(all.filter((i) => !solved[i]))
      if (idx.size === 1) settle([...idx][0], data)
      else if (idx.size > 1) pending.push({ idx, data })
      if (solved.every(Boolean)) {
        const out = new Uint8Array(k * data.length)
        solved.forEach((b, i) => out.set(b!, i * data.length))
        const candidate = out.slice(0, length)
        if (crc32(candidate) === crc) result = candidate
      }
      return result
    },
    progress: () => (k ? solved.filter(Boolean).length / k : 0),
    frames: () => seen.size,
  }
}
