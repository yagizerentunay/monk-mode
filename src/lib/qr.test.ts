import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { encodeQr, MAX_QR_VERSION } from './qr.ts'

/** Matrisi sessiz bölgeli RGBA görüntüye çizip bağımsız bir okuyucuyla (jsQR) çözer. */
function scan(matrix: boolean[][], scale = 4): string | null {
  const quiet = 4
  const n = matrix.length + quiet * 2
  const px = n * scale
  const img = new Uint8ClampedArray(px * px * 4).fill(255)
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * px + (x + quiet) * scale + dx) * 4
          img[i] = img[i + 1] = img[i + 2] = 0
        }
      }
    }
  }
  return jsQR(img, px, px)?.data ?? null
}

describe('QR kodlayıcı', () => {
  it('kısa metni en küçük sürümde (21×21) kodlar ve okunur', () => {
    const m = encodeQr('monk-mode')!
    expect(m).toHaveLength(21)
    expect(scan(m)).toBe('monk-mode')
  })

  // ~1050 baytlık (sürüm 23, L) örnek bilerek yok: jsQR'ın sürüm 23 hizalama tablosu hatalı (78 yerine 74), standart kodu okuyamıyor.
  it.each([30, 120, 300, 700, 900, 1080])('%i karakterlik paylaşım linki okunur', (len) => {
    const text = 'https://example.github.io/monk-mode/#/share/' + 'aB3_-x9Z'.repeat(200).slice(0, len)
    const m = encodeQr(text)!
    expect(m).not.toBeNull()
    expect(scan(m)).toBe(text)
  })

  it('Türkçe karakterleri UTF-8 olarak taşır', () => {
    expect(scan(encodeQr('Göğüs & sırt · ılık')!)).toBe('Göğüs & sırt · ılık')
  })

  it('kapasiteyi aşan metinde null döner', () => {
    expect(encodeQr('x'.repeat(1400))).toBeNull()
    expect(encodeQr('x'.repeat(1200))).toHaveLength(MAX_QR_VERSION * 4 + 17)
    expect(encodeQr('x'.repeat(100), 2)).toBeNull()
  })
})
