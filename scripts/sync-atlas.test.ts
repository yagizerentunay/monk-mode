// sync-atlas.ts uçtan uca testi: sahte bir Atlas çıktısıyla (ağ yok) üretim, kilit ve doğrulama davranışı.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AtlasExercise } from '../src/lib/atlasAdapter.ts'
import { formatRows, sha256, syncAtlas, type AtlasLock } from './sync-atlas.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COMMIT = 'a'.repeat(40)
const OTHER_COMMIT = 'b'.repeat(40)

const WEBP = (n: number) => Buffer.from(`RIFF-fixture-${n}-${'x'.repeat(n)}`)

const records: AtlasExercise[] = [
  {
    id: 'archer-push-up',
    name: { en: 'Archer Push-Up' },
    difficulty: 'intermediate',
    category: 'strength',
    equipment: ['bodyweight'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    instructions: { en: ['Place hands wide.'], tr: ['Ellerini geniş yerleştir.'] },
    legacyIds: ['monk-chest-archer-push-up', 'Archer_Pushup_Old'],
    media: [{ path: 'media/exercises/archer-push-up.webp', role: 'reference' }],
  },
  {
    id: 'plank',
    name: { en: 'Plank' },
    difficulty: 'beginner',
    category: 'strength',
    equipment: ['mat'],
    primaryMuscles: ['abdominals'],
    secondaryMuscles: [],
    instructions: { en: ['Hold a straight line.'] },
  },
  {
    id: 'bench-press',
    name: { en: 'Barbell Bench Press' },
    difficulty: 'intermediate',
    category: 'strength',
    equipment: ['barbell', 'bench'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    instructions: { en: ['Press.'], tr: ['İt.'] },
    legacyIds: ['Barbell_Bench_Press_-_Medium_Grip'],
    media: [
      { path: 'media/exercises/bench-press-start.png', role: 'start' },
      { path: 'media/exercises/bench-press.png', role: 'finish' },
    ],
  },
]

const previousLegacy = [
  { id: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press - Medium Grip', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] },
  { id: 'Keep_Me', name: 'Keep Me', equipment: null, primaryMuscles: ['calves'], secondaryMuscles: [] },
  { id: 'Archer_Pushup_Old', name: 'Old Archer', equipment: 'body only', primaryMuscles: ['chest'], secondaryMuscles: [] },
]

const mediaFiles: Record<string, Buffer> = {
  'media/exercises/archer-push-up.webp': WEBP(10),
  'media/exercises/bench-press.png': WEBP(20),
  'media/exercises/bench-press-start.png': WEBP(30),
}

let work: string
let atlasDir: string
let root: string
const log = () => {}

function put(file: string, data: string | Buffer) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, data)
}

function lockOf(dir = root): AtlasLock {
  return JSON.parse(readFileSync(path.join(dir, 'data/atlas.lock.json'), 'utf8')) as AtlasLock
}

function writeAtlas(dir: string, recs: unknown = records, media: Record<string, Buffer> = mediaFiles) {
  put(path.join(dir, 'dist/exercises.json'), JSON.stringify(recs, null, 2) + '\n')
  for (const [rel, data] of Object.entries(media)) put(path.join(dir, rel), data)
}

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), 'monk-sync-'))
  atlasDir = path.join(work, 'atlas')
  root = path.join(work, 'monk')
  writeAtlas(atlasDir)
  put(path.join(root, 'data/atlas.lock.json'), JSON.stringify({ schemaVersion: 1, repository: 'yagizerentunay/open-exercise-atlas', commit: null, files: {}, generated: {} }, null, 2) + '\n')
  put(path.join(root, 'public/data/legacy-exercises.json'), formatRows(previousLegacy))
  put(path.join(root, 'public/data/exercises.json'), '[]\n')
  put(path.join(root, 'public/exercises/stale.webp'), 'old')
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(work, { recursive: true, force: true })
})

describe('formatRows', () => {
  it('bugünkü public/data dosyalarını bayt bayt yeniden üretir', () => {
    for (const file of ['public/data/exercises.json', 'public/data/legacy-exercises.json']) {
      // Elle eklenen son 17 satırın girintisi eksik; biçim dışında içerik ve satır düzeni aynıdır.
      const text = readFileSync(path.join(REPO_ROOT, file), 'utf8').replace(/^ *{/gm, '  {')
      expect(formatRows(JSON.parse(text) as unknown[]) === text, file).toBe(true)
    }
  })
})

describe('syncAtlas --from --update <sha>', () => {
  it('çıktıları ve kilidi yazar, eski görselleri siler, medyayı bayt bayt kopyalar', async () => {
    const result = await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    expect(result).toMatchObject({ commit: COMMIT, records: 3, library: 3, legacy: 2, media: 2 })

    const library = JSON.parse(readFileSync(path.join(root, 'public/data/exercises.json'), 'utf8')) as { id: string; illustration?: string }[]
    expect(library.map((e) => [e.id, e.illustration])).toEqual([
      ['monk-chest-archer-push-up', 'exercises/archer-push-up.webp'],
      ['Barbell_Bench_Press_-_Medium_Grip', 'exercises/bench-press.png'],
      ['atlas:plank', undefined],
    ])
    const legacy = JSON.parse(readFileSync(path.join(root, 'public/data/legacy-exercises.json'), 'utf8')) as { id: string; name: string }[]
    // Kütüphaneye geçen kimlik düştü, fazladan kimlik yerinde yenilendi.
    expect(legacy.map((e) => [e.id, e.name])).toEqual([
      ['Keep_Me', 'Keep Me'],
      ['Archer_Pushup_Old', 'Archer Push-Up'],
    ])

    expect(readdirSync(path.join(root, 'public/exercises')).sort()).toEqual(['archer-push-up.webp', 'bench-press.png'])
    expect(readFileSync(path.join(root, 'public/exercises/bench-press.png')).equals(mediaFiles['media/exercises/bench-press.png'])).toBe(true)

    const lock = lockOf()
    expect(lock.commit).toBe(COMMIT)
    expect(lock.repository).toBe('yagizerentunay/open-exercise-atlas')
    // Yalnız tüketilen dosyalar: bench-press-start.png kullanılmadı.
    expect(Object.keys(lock.files)).toEqual(['dist/exercises.json', 'media/exercises/archer-push-up.webp', 'media/exercises/bench-press.png'])
    expect(lock.files['media/exercises/bench-press.png']).toBe(sha256(mediaFiles['media/exercises/bench-press.png']))
    expect(lock.files['dist/exercises.json']).toBe(sha256(readFileSync(path.join(atlasDir, 'dist/exercises.json'))))
    expect(lock.generated['public/data/exercises.json']).toBe(sha256(readFileSync(path.join(root, 'public/data/exercises.json'))))
    expect(lock.generated['public/data/legacy-exercises.json']).toBe(sha256(readFileSync(path.join(root, 'public/data/legacy-exercises.json'))))
  })

  it('ikinci çalıştırma değişiklik yapmaz; --check geçer, bozulmuş çıktıda ve eski görselde hata verir', async () => {
    await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    expect((await syncAtlas({ root, from: atlasDir, log })).changed).toEqual([])
    await expect(syncAtlas({ root, from: atlasDir, check: true, log })).resolves.toMatchObject({ changed: [] })

    put(path.join(root, 'public/exercises/orphan.webp'), 'x')
    await expect(syncAtlas({ root, from: atlasDir, check: true, log })).rejects.toThrow(/orphan\.webp/)
    expect(readdirSync(path.join(root, 'public/exercises'))).toContain('orphan.webp') // --check dosya silmez

    rmSync(path.join(root, 'public/exercises/orphan.webp'))
    put(path.join(root, 'public/data/exercises.json'), '[]\n')
    await expect(syncAtlas({ root, from: atlasDir, check: true, log })).rejects.toThrow(/exercises\.json/)
  })

  it('sabitlenmiş commit için kaynak içerik değiştiyse sha256 uyuşmazlığı hatası verir', async () => {
    await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    put(path.join(atlasDir, 'media/exercises/bench-press.png'), WEBP(99))
    await expect(syncAtlas({ root, from: atlasDir, log })).rejects.toThrow(/bench-press\.png: sha256 uyuşmuyor/)
    // Yeni bir commit'e sabitlenirken içerik serbestçe değişir.
    const result = await syncAtlas({ root, from: atlasDir, update: OTHER_COMMIT, log })
    expect(result.commit).toBe(OTHER_COMMIT)
    expect(lockOf().files['media/exercises/bench-press.png']).toBe(sha256(WEBP(99)))
  })

  it('eksik medya dosyası, kayıt adını taşıyan ya da dosyayı gösteren hata verir', async () => {
    rmSync(path.join(atlasDir, 'media/exercises/archer-push-up.webp'))
    await expect(syncAtlas({ root, from: atlasDir, update: COMMIT, log })).rejects.toThrow(/archer-push-up\.webp/)
    expect(readdirSync(path.join(root, 'public/exercises'))).toEqual(['stale.webp']) // hiçbir şey yazılmadı
  })

  it('adaptör hatası (custom- kimliği) hiçbir dosyayı değiştirmez', async () => {
    const bad = structuredClone(records)
    bad[1].legacyIds = ['custom-77']
    writeAtlas(atlasDir, bad)
    await expect(syncAtlas({ root, from: atlasDir, update: COMMIT, log })).rejects.toThrow(/custom-/)
    expect(readFileSync(path.join(root, 'public/data/exercises.json'), 'utf8')).toBe('[]\n')
    expect(lockOf().commit).toBeNull()
  })

  it('kilitte commit yokken --update olmadan çalışmayı reddeder; --check ile --update birlikte olmaz', async () => {
    await expect(syncAtlas({ root, from: atlasDir, log })).rejects.toThrow(/Kilitte commit yok/)
    await expect(syncAtlas({ root, from: atlasDir, update: COMMIT, check: true, log })).rejects.toThrow(/birlikte/)
  })

  it('--update sha vermeden git deposunun HEAD commit\'ini sabitler ve kirli çalışma kopyasını reddeder', async () => {
    const git = (...args: string[]) => execFileSync('git', ['-C', atlasDir, ...args], { encoding: 'utf8' }).trim()
    const commit = (message: string) => {
      git('add', '-A')
      git('-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message)
    }
    git('init', '-q')
    commit('fixture')
    const head = git('rev-parse', 'HEAD')
    const result = await syncAtlas({ root, from: atlasDir, update: true, log })
    expect(result.commit).toBe(head)
    expect(lockOf().commit).toBe(head)

    // Yeni commit'te içerik değişir; sonra commit'lenmemiş bir değişiklik reddedilir.
    put(path.join(atlasDir, 'media/exercises/bench-press.png'), WEBP(77))
    commit('change picture')
    put(path.join(atlasDir, 'media/exercises/bench-press.png'), WEBP(78))
    await expect(syncAtlas({ root, from: atlasDir, update: true, log })).rejects.toThrow(/commit'lenmemiş/)
    expect(lockOf().commit).toBe(head)
  })
})

describe('syncAtlas (ağdan)', () => {
  function stubFetch(served: Map<string, Buffer>) {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (input: string | URL) => {
      const url = String(input)
      urls.push(url)
      const prefix = `https://raw.githubusercontent.com/yagizerentunay/open-exercise-atlas/${COMMIT}/`
      const body = url.startsWith(prefix) ? served.get(decodeURIComponent(url.slice(prefix.length))) : undefined
      return body ? new Response(new Uint8Array(body)) : new Response('not found', { status: 404 })
    })
    return urls
  }
  const served = () =>
    new Map<string, Buffer>([['dist/exercises.json', readFileSync(path.join(atlasDir, 'dist/exercises.json'))], ...Object.entries(mediaFiles)])

  it('kilitteki commit için raw.githubusercontent.com adreslerinden indirir ve özetleri doğrular', async () => {
    await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    rmSync(path.join(root, 'public/exercises'), { recursive: true })
    const urls = stubFetch(served())
    const result = await syncAtlas({ root, log })
    expect(result.changed.sort()).toEqual(['public/exercises/archer-push-up.webp', 'public/exercises/bench-press.png'])
    expect(urls).toContain(`https://raw.githubusercontent.com/yagizerentunay/open-exercise-atlas/${COMMIT}/dist/exercises.json`)
    // Yalnız seçilen görseller indirilir.
    expect(urls.some((u) => u.includes('bench-press-start.png'))).toBe(false)
    await expect(syncAtlas({ root, check: true, log })).resolves.toMatchObject({ changed: [] })
  })

  it('indirilen dosya kilitteki özetle uyuşmazsa hata verir ve hiçbir şey yazmaz', async () => {
    await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    const tampered = served()
    tampered.set('media/exercises/archer-push-up.webp', WEBP(11))
    stubFetch(tampered)
    const before = readFileSync(path.join(root, 'public/exercises/archer-push-up.webp'))
    await expect(syncAtlas({ root, log })).rejects.toThrow(/archer-push-up\.webp: sha256 uyuşmuyor/)
    expect(readFileSync(path.join(root, 'public/exercises/archer-push-up.webp')).equals(before)).toBe(true)
  })

  it('indirme başarısızsa (404) dosya adını bildirir', async () => {
    await syncAtlas({ root, from: atlasDir, update: COMMIT, log })
    const partial = served()
    partial.delete('media/exercises/bench-press.png')
    stubFetch(partial)
    await expect(syncAtlas({ root, log })).rejects.toThrow(/bench-press\.png.*indirilemedi/s)
  })
})
