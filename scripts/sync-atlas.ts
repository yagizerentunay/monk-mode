// Egzersiz kataloğunu Open Exercise Atlas'tan üretir: `npm run data:atlas` (bkz. docs/atlas-data.md).
//   node scripts/sync-atlas.ts                    kilitteki commit'i indirir ve çıktıları yazar
//   node scripts/sync-atlas.ts --from <dizin>     yerel bir Atlas çalışma kopyasından okur (dist/ ve media/)
//   node scripts/sync-atlas.ts --update [<sha>]   pini yeniler (varsayılan: main'in ucu) ve kilidi yazar
//   node scripts/sync-atlas.ts --check            yeniden üretir; commit'lenmiş çıktılardan farklıysa hata verir
// Kaynak değiştirilmez; yalnız public/data/exercises.json, public/data/legacy-exercises.json,
// public/exercises/* ve data/atlas.lock.json yazılır. `--root <dizin>` çıktıların kökünü değiştirir (testler için).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { atlasToCatalog, type AtlasExercise } from '../src/lib/atlasAdapter.ts'
import { libraryProblems, type LegacyRecord } from '../src/lib/exerciseData.ts'

export const REPOSITORY = 'yagizerentunay/open-exercise-atlas'
const DIST = 'dist/exercises.json'
const LOCK = 'data/atlas.lock.json'
const OUT_LIBRARY = 'public/data/exercises.json'
const OUT_LEGACY = 'public/data/legacy-exercises.json'
const OUT_MEDIA = 'public/exercises'

export interface AtlasLock {
  schemaVersion: 1
  /** `sahip/depo` (GitHub). */
  repository: string
  /** Sabitlenen commit (40 hex); henüz hiç senkronlanmadıysa `null`. */
  commit: string | null
  /** Tüketilen her Atlas dosyasının (dist/exercises.json ve medya) sha256'sı; anahtarlar sıralı. */
  files: Record<string, string>
  /** Üretilen iki JSON dosyasının (`public/data/...`) sha256'sı. */
  generated: Record<string, string>
}

export interface SyncOptions {
  /** Projenin kökü (çıktılar ve kilit buraya yazılır). */
  root: string
  /** Yerel Atlas çalışma kopyası; yoksa raw.githubusercontent.com'dan indirilir. */
  from?: string
  /** `true`: main'in ucuna yeniden sabitle; metin: commit sha'sı ya da dal adı. */
  update?: boolean | string
  check?: boolean
  log?: (line: string) => void
}

export interface SyncResult {
  commit: string
  records: number
  library: number
  legacy: number
  media: number
  changed: string[]
}

export function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** Bugünkü dosyalarla aynı biçim: bir satırda bir nesne, 2 boşluk girinti, sonda yeni satır. */
export function formatRows(rows: readonly unknown[]): string {
  if (rows.length === 0) return '[]\n'
  return `[\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(',\n')}\n]\n`
}

function formatLock(lock: AtlasLock): string {
  const sorted = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return JSON.stringify({ ...lock, files: sorted(lock.files), generated: sorted(lock.generated) }, null, 2) + '\n'
}

interface Source {
  label: string
  read(rel: string): Promise<Buffer>
}

function localSource(dir: string): Source {
  return {
    label: `yerel kopya ${dir}`,
    read: async (rel) => {
      const file = path.join(dir, ...rel.split('/'))
      if (!existsSync(file)) throw new Error(`${rel}: ${dir} içinde yok`)
      return readFileSync(file)
    },
  }
}

function rawUrl(commit: string, rel: string): string {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${commit}/${rel.split('/').map(encodeURIComponent).join('/')}`
}

function remoteSource(commit: string): Source {
  return {
    label: `${REPOSITORY}@${commit.slice(0, 12)}`,
    read: async (rel) => {
      let lastError = ''
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(rawUrl(commit, rel))
          if (res.ok) return Buffer.from(await res.arrayBuffer())
          lastError = `HTTP ${res.status}`
          if (res.status === 404) break
        } catch (e) {
          lastError = (e as Error).message
        }
      }
      throw new Error(`${rel}: ${REPOSITORY}@${commit.slice(0, 12)} içinden indirilemedi (${lastError})`)
    },
  }
}

const SHA = /^[0-9a-f]{40}$/

async function githubCommit(ref: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(ref)}`, {
    headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'monk-mode-sync-atlas' },
  })
  if (!res.ok) throw new Error(`GitHub "${ref}" için commit döndürmedi (HTTP ${res.status})`)
  const sha = (await res.text()).trim()
  if (!SHA.test(sha)) throw new Error(`GitHub'dan beklenmeyen yanıt: ${sha.slice(0, 80)}`)
  return sha
}

async function remoteHead(): Promise<string> {
  try {
    const out = execFileSync('git', ['ls-remote', `https://github.com/${REPOSITORY}.git`, 'refs/heads/main'], { encoding: 'utf8' })
    const sha = out.split(/\s/)[0]
    if (SHA.test(sha)) return sha
  } catch {
    // git yoksa ya da ağ erişimi başarısızsa API denenir.
  }
  return githubCommit('main')
}

function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

/** Yerel kopyadaki tüketilen dosyaların HEAD ile aynı olduğunu doğrular (kilit yalnız commit'lenmiş içeriği taşısın). */
function assertCleanAgainstHead(dir: string, consumed: ReadonlySet<string>): void {
  const out = git(dir, ['status', '--porcelain', '-z', '--untracked-files=all', '--no-renames'])
  if (out === null) throw new Error(`${dir} bir git deposu değil`)
  const dirty = out
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .filter((p) => consumed.has(p))
  if (dirty.length > 0) {
    throw new Error(
      `${dir} içinde commit'lenmemiş (ya da izlenmeyen) Atlas dosyaları var; önce commit'le:\n  ${dirty.slice(0, 10).join('\n  ')}`,
    )
  }
}

async function pool<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

function readText(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function readLock(root: string): AtlasLock {
  const text = readText(path.join(root, LOCK))
  if (text === null) throw new Error(`${LOCK} yok`)
  const lock = JSON.parse(text) as AtlasLock
  if (lock.schemaVersion !== 1 || typeof lock.repository !== 'string' || typeof lock.files !== 'object' || typeof lock.generated !== 'object') {
    throw new Error(`${LOCK} biçimi tanınmıyor`)
  }
  if (lock.commit !== null && !SHA.test(lock.commit)) throw new Error(`${LOCK}: commit 40 haneli sha olmalı`)
  if (lock.repository !== REPOSITORY) throw new Error(`${LOCK}: depo ${lock.repository}, beklenen ${REPOSITORY}`)
  return lock
}

export async function syncAtlas(opts: SyncOptions): Promise<SyncResult> {
  const log = opts.log ?? ((line: string) => console.log(line))
  const root = path.resolve(opts.root)
  if (opts.check && opts.update) throw new Error('--check ile --update birlikte kullanılamaz')
  const lock = readLock(root)

  // 1. Kaynak ve commit.
  let commit: string
  let source: Source
  let localHead: string | null = null
  if (opts.from) {
    const dir = path.resolve(opts.from)
    source = localSource(dir)
    const head = git(dir, ['rev-parse', 'HEAD'])?.trim() ?? null
    localHead = head
    if (opts.update) {
      if (typeof opts.update === 'string') {
        if (!SHA.test(opts.update)) throw new Error('--from ile birlikte --update için tam (40 haneli) commit sha\'sı ver')
        if (head !== null && head !== opts.update) throw new Error(`${dir} HEAD'i ${head}, istenen ${opts.update}`)
        commit = opts.update
      } else {
        if (head === null) throw new Error(`${dir} bir git deposu değil; commit sha'sını --update <sha> ile ver`)
        commit = head
      }
    } else {
      if (lock.commit === null) throw new Error('Kilitte commit yok; önce `--update` ile sabitle')
      commit = lock.commit
    }
  } else if (opts.update) {
    const ref = typeof opts.update === 'string' ? opts.update : null
    commit = ref === null ? await remoteHead() : SHA.test(ref) ? ref : await githubCommit(ref)
    source = remoteSource(commit)
  } else {
    if (lock.commit === null) throw new Error('Kilitte commit yok; önce `npm run data:atlas:update` çalıştır')
    commit = lock.commit
    source = remoteSource(commit)
  }
  // Commit değişmediyse indirilen/okunan her dosya kilitteki özetle eşleşmek zorundadır.
  const expected = lock.commit !== null && lock.commit === commit ? lock.files : null
  const verify = (rel: string, data: Buffer): void => {
    if (expected === null) return
    const want = expected[rel]
    if (want === undefined) throw new Error(`${rel}: kilitte yok (kilit ${commit.slice(0, 12)} için eksik; \`--update\` çalıştır)`)
    const got = sha256(data)
    if (got !== want) {
      throw new Error(`${rel}: sha256 uyuşmuyor (kilit ${want.slice(0, 12)}…, gelen ${got.slice(0, 12)}…); ${source.label} sabitlenen içerikten farklı`)
    }
  }

  // 2. Atlas kayıtları.
  log(`Kaynak: ${source.label}`)
  const distBytes = await source.read(DIST)
  verify(DIST, distBytes)
  const records = JSON.parse(distBytes.toString('utf8')) as AtlasExercise[]
  if (!Array.isArray(records)) throw new Error(`${DIST}: kayıt listesi bekleniyordu`)

  const previousLegacy = JSON.parse(readText(path.join(root, OUT_LEGACY)) ?? '[]') as LegacyRecord[]
  const plan = atlasToCatalog(records, previousLegacy)

  // 3. Medya dosyaları.
  const mediaBytes = new Map<string, Buffer>() // Atlas yolu -> içerik
  const missing: string[] = []
  await pool(plan.media, 8, async (m) => {
    try {
      mediaBytes.set(m.from, await source.read(m.from))
    } catch (e) {
      missing.push((e as Error).message)
    }
  })
  if (missing.length > 0) throw new Error(`Eksik medya dosyaları:\n  ${missing.sort().join('\n  ')}`)
  for (const [rel, data] of mediaBytes) verify(rel, data)
  if (expected !== null) {
    const stale = Object.keys(expected).filter((k) => k !== DIST && !mediaBytes.has(k))
    if (stale.length > 0) throw new Error(`Kilitte artık kullanılmayan dosyalar var: ${stale.slice(0, 5).join(', ')}; \`--update\` çalıştır`)
  }

  // 4. Katalog (bu sefer dosyaların varlığı doğrulanarak) ve çıktı metinleri.
  const catalog = atlasToCatalog(records, previousLegacy, { mediaFiles: new Set(mediaBytes.keys()) })
  const problems = libraryProblems(catalog.library)
  if (problems.length > 0) throw new Error(`Üretilen kütüphane geçersiz:\n  ${problems.join('\n  ')}`)
  const outputs = new Map<string, string | Buffer>([
    [OUT_LIBRARY, formatRows(catalog.library)],
    [OUT_LEGACY, formatRows(catalog.legacy)],
    ...catalog.media.map((m) => [`public/${m.to}`, mediaBytes.get(m.from)!] as const),
  ])
  const files: Record<string, string> = { [DIST]: sha256(distBytes) }
  for (const [rel, data] of mediaBytes) files[rel] = sha256(data)
  const nextLock: AtlasLock = {
    schemaVersion: 1,
    repository: REPOSITORY,
    commit,
    files,
    generated: {
      [OUT_LIBRARY]: sha256(outputs.get(OUT_LIBRARY) as string),
      [OUT_LEGACY]: sha256(outputs.get(OUT_LEGACY) as string),
    },
  }
  const lockText = formatLock(nextLock)

  // Yerel kopyadan sabitlerken kilit yalnız commit'lenmiş içeriği taşımalı (uzaktan indirme aynı özetleri görsün).
  if (opts.from && opts.update && localHead !== null) assertCleanAgainstHead(path.resolve(opts.from), new Set(Object.keys(files)))

  // 5. Yaz ya da karşılaştır.
  const changed: string[] = []
  const mediaDir = path.join(root, OUT_MEDIA)
  const existingMedia = existsSync(mediaDir) ? readdirSync(mediaDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name) : []
  const wantedMedia = new Set(catalog.media.map((m) => path.posix.basename(m.to)))
  for (const [rel, content] of [...outputs, [LOCK, lockText] as const]) {
    const file = path.join(root, ...rel.split('/'))
    const current = existsSync(file) ? readFileSync(file) : null
    const next = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
    if (current !== null && current.equals(next)) continue
    changed.push(rel)
    if (!opts.check) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, next)
    }
  }
  for (const name of existingMedia) {
    if (wantedMedia.has(name)) continue
    changed.push(`${OUT_MEDIA}/${name} (silinecek)`)
    if (!opts.check) rmSync(path.join(mediaDir, name))
  }

  const result: SyncResult = {
    commit,
    records: records.length,
    library: catalog.library.length,
    legacy: catalog.legacy.length,
    media: catalog.media.length,
    changed,
  }
  log(`${result.records} Atlas kaydı -> ${result.library} kütüphane kaydı, ${result.legacy} eski kimlik, ${result.media} görsel (${commit.slice(0, 12)}).`)
  if (opts.check) {
    if (changed.length > 0) {
      throw new Error(`Commit'lenmiş çıktılar ${source.label} ile uyuşmuyor; \`npm run data:atlas\` çalıştırıp commit'le:\n  ${changed.slice(0, 20).join('\n  ')}${changed.length > 20 ? `\n  … ve ${changed.length - 20} dosya daha` : ''}`)
    }
    log('Çıktılar güncel.')
  } else {
    log(changed.length === 0 ? 'Değişiklik yok.' : `${changed.length} dosya yazıldı ya da silindi.`)
  }
  return result
}

function parseArgs(argv: string[]): SyncOptions {
  const opts: SyncOptions = { root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = (): string => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} bir değer bekliyor`)
      return v
    }
    if (a === '--from') opts.from = value()
    else if (a === '--root') opts.root = value()
    else if (a === '--check') opts.check = true
    else if (a === '--update') opts.update = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true
    else if (a === '--help' || a === '-h') {
      console.log('kullanım: node scripts/sync-atlas.ts [--from <dizin>] [--update [<sha>]] [--check]')
      process.exit(0)
    } else throw new Error(`bilinmeyen seçenek: ${a}`)
  }
  return opts
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await syncAtlas(parseArgs(process.argv.slice(2)))
  } catch (e) {
    console.error(`sync-atlas: ${(e as Error).message}`)
    process.exitCode = 1
  }
}
