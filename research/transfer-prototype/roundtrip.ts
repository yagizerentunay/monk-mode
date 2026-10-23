// Uçtan uca: yedek JSON → deflate-raw → fountain çerçeveleri → QR PNG → jsQR ile okuma → birleştirme → karşılaştırma.
// Kullanım: BLOCK=500 LOSS=0.3 ECC=M node roundtrip.ts yedek.json
import { readFile } from 'node:fs/promises'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import QRCode from 'qrcode'
import { createDecoder, createEncoder } from './fountain.ts'

const json = await readFile(process.argv[2], 'utf8')
const packed = deflateRawSync(json, { level: 9 })
const blockSize = Number(process.env.BLOCK ?? 500)
const loss = Number(process.env.LOSS ?? 0.3)
const ecc = (process.env.ECC ?? 'M') as 'L' | 'M'
const enc = createEncoder(packed, blockSize)
const dec = createDecoder()

// Kameranın kaçırdığı kareler: deterministik, tekrarlanabilir.
let r = Number(process.env.SEED ?? 7)
const rand = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648

let seed = 0
let version = 0
let out: Uint8Array | null = null
const t0 = Date.now()
while (!out) {
  const text = enc.frame(seed++)
  if (rand() < loss) continue
  version = QRCode.create(text, { errorCorrectionLevel: ecc }).version
  const png = PNG.sync.read(await QRCode.toBuffer(text, { errorCorrectionLevel: ecc, scale: 3, margin: 2 }))
  const read = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  if (!read) throw new Error(`jsQR çerçeveyi okuyamadı (tohum ${seed - 1})`)
  out = dec.add(read.data)
}
const back = inflateRawSync(out).toString('utf8')
console.log(
  JSON.stringify({
    jsonKB: +(Buffer.byteLength(json) / 1024).toFixed(1),
    packedKB: +(packed.length / 1024).toFixed(1),
    blockSize,
    ecc,
    loss,
    qrVersion: version,
    k: enc.k,
    shown: seed,
    scanned: dec.frames(),
    overhead: +(dec.frames() / enc.k).toFixed(2),
    secondsAt5fps: +(seed / 5).toFixed(1),
    identical: back === json,
    ms: Date.now() - t0,
  }),
)
