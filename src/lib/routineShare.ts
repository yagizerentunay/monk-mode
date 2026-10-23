import type { CustomExercise, ExCfg, ProgressionMode, Routine } from '../store/schema.ts'
import { MAX_ROUTINE_SETS } from './intensity.ts'
import { sanitizeRoutine } from './mergeRoutines.ts'
import { MAX_TIMED_SEC } from './timed.ts'

/**
 * Rutin paylaşımı (sunucusuz): rutin küçük, sürümlü bir JSON'a çevrilir, `deflate-raw` ile sıkıştırılır ve
 * base64url olarak `#/share/<payload>` linkine konur. Link açılınca aynı yol geriye çözülür; doğrulama
 * `sanitizeRoutine` ile yapılır. Veri hash'te kaldığı için hiçbir sunucuya gitmez.
 *
 * Biçim (v1): `{ v: 1, n: ad, e: [egzersiz…], c?: [özel egzersiz…] }`. Link kısa kalsın (QR'a sığsın) diye
 * egzersizler sıralı dizidir: `[exId, sets, reps, repsMax, weight, prog, inc, bayraklar, warmups, drops, restSec]`.
 * Olmayan isteğe bağlı alan `null` yazılır; sondaki boş alanlar (ve sıfır bayrak) hiç yazılmaz. Bayraklar: 1 tek taraflı, 2 süperset, 4 vücut ağırlığı, 8 süreli.
 * Özel egzersiz: `[id, ad, birincil kaslar, ekipman]`; yalnız rutinde geçenler eklenir.
 */
export const SHARE_VERSION = 1
/** Linkteki payload'un en uzun hâli (karakter). Daha büyük rutin paylaşılamaz, daha büyük link reddedilir. */
export const MAX_PAYLOAD_CHARS = 4000
/** Açılmış JSON'un en büyük boyutu (bayt); sıkıştırma bombasına karşı açma bu sınırda kesilir. */
export const MAX_JSON_BYTES = 64 * 1024
export const MAX_SHARE_EXERCISES = 60
export const MAX_NAME_CHARS = 80

const PROGS: readonly ProgressionMode[] = ['off', 'linear', 'double']
const FLAG_SIDE = 1
const FLAG_SUPERSET = 2
const FLAG_BW = 4
const FLAG_TIMED = 8

type ShareEx = [string, number, number, number, number, number, number, number?, (number | null)?, (number | null)?, (number | null)?]
type ShareCustom = [string, string, string[], string]

interface SharePayload {
  v: number
  n: string
  e: ShareEx[]
  c?: ShareCustom[]
}

/** Kullanıcıya gösterilecek Türkçe mesajla paylaşım hatası. */
export class ShareError extends Error {
  override name = 'ShareError'
}

export interface SharedRoutine {
  /** Doğrulanmış rutin; kimliği boştur, eklerken yenisi verilir. */
  routine: Routine
  /** Rutinde geçen, paylaşanın özel egzersizleri. */
  customEx: CustomExercise[]
}

function toShareEx(cfg: ExCfg): ShareEx {
  const flags =
    (cfg.side ? FLAG_SIDE : 0) | (cfg.superset ? FLAG_SUPERSET : 0) | (cfg.bw ? FLAG_BW : 0) | (cfg.timed ? FLAG_TIMED : 0)
  const row: ShareEx = [cfg.exId, cfg.sets, cfg.reps, cfg.repsMax, cfg.weight, PROGS.indexOf(cfg.prog), cfg.inc]
  const tail: (number | null)[] = [flags, cfg.warmups ?? null, cfg.drops ?? null, cfg.restSec ?? null]
  while (tail.length > 0 && (tail[tail.length - 1] === null || (tail.length === 1 && tail[0] === 0))) tail.pop()
  return [...row, ...tail] as ShareEx
}

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const clamp = (v: number | undefined, max: number): number | undefined => (v === undefined ? undefined : Math.min(max, v))

/** Dizi biçimindeki egzersizi `sanitizeRoutine`'in beklediği ham nesneye çevirir; aşırı sayılar kırpılır. */
function fromShareEx(raw: unknown): Record<string, unknown> | null {
  if (!Array.isArray(raw) || typeof raw[0] !== 'string' || raw[0].length > 200) return null
  const flags = finite(raw[7]) ?? 0
  const timed = (flags & FLAG_TIMED) !== 0
  const repLimit = timed ? MAX_TIMED_SEC : 1000
  const weight = finite(raw[4])
  return {
    exId: raw[0],
    sets: clamp(finite(raw[1]), MAX_ROUTINE_SETS),
    reps: clamp(finite(raw[2]), repLimit),
    repsMax: clamp(finite(raw[3]), repLimit),
    weight: weight === undefined || Math.abs(weight) > 1000 ? undefined : weight,
    prog: PROGS[finite(raw[5]) ?? -1],
    inc: clamp(finite(raw[6]), 100),
    side: (flags & FLAG_SIDE) !== 0,
    superset: (flags & FLAG_SUPERSET) !== 0,
    bw: (flags & FLAG_BW) !== 0,
    timed,
    warmups: finite(raw[8]),
    drops: finite(raw[9]),
    restSec: clamp(finite(raw[10]), MAX_TIMED_SEC),
  }
}

function fromShareCustom(raw: unknown): CustomExercise | null {
  if (!Array.isArray(raw) || typeof raw[0] !== 'string' || raw[0] === '' || typeof raw[1] !== 'string') return null
  const name = raw[1].trim().slice(0, MAX_NAME_CHARS)
  if (name === '') return null
  return {
    id: raw[0],
    name,
    primaryMuscles: Array.isArray(raw[2]) ? raw[2].filter((m): m is string => typeof m === 'string').slice(0, 10) : [],
    equipment: typeof raw[3] === 'string' ? raw[3].slice(0, 40) : '',
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new ShareError('Link bozuk: geçersiz karakter var.')
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  let bin: string
  try {
    bin = atob(b64)
  } catch {
    throw new ShareError('Link bozuk: kodlama çözülemedi.')
  }
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Akışı sonuna kadar okur; `limit` bayt aşılırsa okumayı keser ve hata verir. */
async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel().catch(() => {})
      throw new ShareError('Link çok büyük.')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

const supported = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'

/** Rutini paylaşım payload'una çevirir. Çok büyük rutinde ya da desteklenmeyen tarayıcıda ShareError verir. */
export async function encodeRoutine(routine: Routine, customEx: readonly CustomExercise[] = []): Promise<string> {
  if (!supported()) throw new ShareError('Bu tarayıcı paylaşım linki oluşturamıyor.')
  if (routine.ex.length > MAX_SHARE_EXERCISES) throw new ShareError(`Rutin paylaşmak için çok büyük (en çok ${MAX_SHARE_EXERCISES} egzersiz).`)
  const used = new Set(routine.ex.map((e) => e.exId))
  const custom = customEx
    .filter((c) => used.has(c.id))
    .map((c): ShareCustom => [c.id, c.name, c.primaryMuscles, c.equipment])
  const payload: SharePayload = { v: SHARE_VERSION, n: routine.name.slice(0, MAX_NAME_CHARS), e: routine.ex.map(toShareEx) }
  if (custom.length > 0) payload.c = custom
  const json = new TextEncoder().encode(JSON.stringify(payload))
  const packed = await readAll(streamOf(json).pipeThrough(new CompressionStream('deflate-raw')), Infinity)
  const text = toBase64Url(packed)
  if (text.length > MAX_PAYLOAD_CHARS) throw new ShareError('Rutin paylaşmak için çok büyük: birkaç egzersizi ayrı bir rutine bölmeyi dene.')
  return text
}

/** Paylaşım payload'unu çözer ve doğrular. Bozuk, çok büyük ya da desteklenmeyen sürümde ShareError verir. */
export async function decodeRoutine(text: string): Promise<SharedRoutine> {
  if (!supported()) throw new ShareError('Bu tarayıcı paylaşım linkini açamıyor.')
  if (text.length === 0) throw new ShareError('Link boş.')
  if (text.length > MAX_PAYLOAD_CHARS) throw new ShareError('Link çok büyük.')
  const packed = fromBase64Url(text)
  let json: Uint8Array
  try {
    json = await readAll(streamOf(packed).pipeThrough(new DecompressionStream('deflate-raw')), MAX_JSON_BYTES)
  } catch (e) {
    if (e instanceof ShareError) throw e
    throw new ShareError('Link bozuk: veri açılamadı.')
  }
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json))
  } catch {
    throw new ShareError('Link bozuk: veri okunamadı.')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new ShareError('Link bozuk: beklenmeyen veri.')
  const p = data as Record<string, unknown>
  if (typeof p.v !== 'number') throw new ShareError('Link bozuk: sürüm yok.')
  if (p.v > SHARE_VERSION) throw new ShareError('Bu link uygulamanın daha yeni bir sürümüyle oluşturulmuş; önce uygulamayı güncelle.')
  if (p.v !== SHARE_VERSION) throw new ShareError('Bu link biçimi desteklenmiyor.')
  if (!Array.isArray(p.e) || p.e.length > MAX_SHARE_EXERCISES) throw new ShareError('Link bozuk: egzersiz listesi geçersiz.')
  const name = typeof p.n === 'string' ? p.n.slice(0, MAX_NAME_CHARS) : ''
  const routine = sanitizeRoutine({ id: 'shared', name, ex: p.e.map(fromShareEx) })
  if (!routine) throw new ShareError('Linkte geçerli egzersiz yok.')
  const used = new Set(routine.ex.map((e) => e.exId))
  const customEx = (Array.isArray(p.c) ? p.c : [])
    .map(fromShareCustom)
    .filter((c): c is CustomExercise => c !== null && used.has(c.id))
  return { routine: { ...routine, id: '' }, customEx }
}

/** Uygulamanın şu anki adresinden paylaşım linki: `<origin><yol>#/share/<payload>`. */
export function shareUrl(payload: string, loc: Pick<Location, 'origin' | 'pathname'> = location): string {
  return `${loc.origin}${loc.pathname}#/share/${payload}`
}
