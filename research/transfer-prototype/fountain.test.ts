import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { demoState } from './demo-year.ts'
import { base45Decode, base45Encode, createDecoder, createEncoder } from './fountain.ts'

/** Kameranın kaçırdığı kareler için deterministik rastgelelik. */
function lcg(seed: number): () => number {
  let r = seed
  return () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648
}

function transfer(data: Uint8Array, blockSize: number, loss: number, seed: number) {
  const enc = createEncoder(data, blockSize)
  const dec = createDecoder()
  const rand = lcg(seed)
  let out: Uint8Array | null = null
  let shown = 0
  while (!out && shown < enc.k * 20) {
    const text = enc.frame(shown++)
    if (rand() >= loss) out = dec.add(text)
  }
  return { out, k: enc.k, shown }
}

describe('base45', () => {
  it('her bayt dizisini geri verir ve yalnız QR alfanümerik karakterleri kullanır', () => {
    const bytes = Uint8Array.from({ length: 257 }, (_, i) => (i * 37) & 255)
    const text = base45Encode(bytes)
    expect(text).toMatch(/^[0-9A-Z $%*+\-./:]*$/)
    expect(base45Decode(text)).toEqual(bytes)
  })
})

describe('fountain', () => {
  const json = JSON.stringify({ app: 'monk-mode', exportedAt: '2026-10-23T09:00:00.000Z', state: demoState() })
  const packed = new Uint8Array(deflateRawSync(json))

  it('kayıpsız aktarımda tam k kareyle biter', () => {
    const { out, k, shown } = transfer(packed, 500, 0, 1)
    expect(shown).toBe(k)
    expect(inflateRawSync(out!).toString()).toBe(json)
  })

  it.each([1, 2, 3, 4, 5])('%%40 kayıpla da bit bit aynı veriyi kurar (tohum %i)', (seed) => {
    const { out, k, shown } = transfer(packed, 300, 0.4, seed)
    expect(out).not.toBeNull()
    expect(inflateRawSync(out!).toString()).toBe(json)
    expect(shown).toBeLessThan(k * 4)
  })

  it('ilk okunan aktarıma kilitlenir, başka aktarımın karelerini yok sayar', () => {
    const a = createEncoder(packed, 400)
    const b = createEncoder(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]), 400)
    const dec = createDecoder()
    let out: Uint8Array | null = null
    for (let s = 0; !out; s++) {
      out = dec.add(a.frame(s))
      expect(dec.add(b.frame(s))).toBe(out)
    }
    expect(inflateRawSync(out).toString()).toBe(json)
  })
})
