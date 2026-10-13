import { describe, expect, it } from 'vitest'
import exercisesFile from '../../public/data/exercises.json?raw'
import legacyFile from '../../public/data/legacy-exercises.json?raw'
import lockFile from '../../data/atlas.lock.json?raw'

interface Lock {
  schemaVersion: number
  repository: string
  commit: string | null
  files: Record<string, string>
  generated: Record<string, string>
}

const lock = JSON.parse(lockFile) as Lock
const SHA256 = /^[0-9a-f]{64}$/

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('data/atlas.lock.json', () => {
  it('biçim: şema, depo, commit ve sha256 tabloları', () => {
    expect(lock.schemaVersion).toBe(1)
    expect(lock.repository).toBe('yagizerentunay/open-exercise-atlas')
    expect(lock.commit === null || /^[0-9a-f]{40}$/.test(lock.commit)).toBe(true)
    expect(Object.keys(lock.files).sort()).toEqual(Object.keys(lock.files))
    expect(Object.keys(lock.generated).sort()).toEqual(Object.keys(lock.generated))
    for (const hash of [...Object.values(lock.files), ...Object.values(lock.generated)]) expect(hash).toMatch(SHA256)
  })

  // Kilit henüz yazılmadıysa (commit: null) `npm run data:atlas:update` bekleniyor; o zamana kadar atlanır.
  const synced = lock.commit !== null
  it.skipIf(!synced)('kilitte dist/exercises.json ve her görsel için özet var', () => {
    expect(lock.files['dist/exercises.json']).toMatch(SHA256)
    const media = Object.keys(lock.files).filter((p) => p !== 'dist/exercises.json')
    expect(media.length).toBeGreaterThan(0)
    for (const p of media) expect(p, p).toMatch(/^media\/.+\.(webp|png)$/)
  })

  it.skipIf(!synced)('üretilen JSON dosyalarının özetleri kilitle eşleşir (npm run data:atlas ile yenile)', async () => {
    expect(Object.keys(lock.generated).sort()).toEqual(['public/data/exercises.json', 'public/data/legacy-exercises.json'])
    expect(await sha256(exercisesFile)).toBe(lock.generated['public/data/exercises.json'])
    expect(await sha256(legacyFile)).toBe(lock.generated['public/data/legacy-exercises.json'])
  })

  it.skipIf(synced)('kilit henüz senkronlanmadı: `npm run data:atlas:update` çalıştır', () => {
    expect(lock.files).toEqual({})
    expect(lock.generated).toEqual({})
  })
})
