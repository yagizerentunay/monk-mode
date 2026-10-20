import { describe, expect, it } from 'vitest'
import {
  backupFileName,
  ensurePermission,
  filesToPrune,
  KEEP_FILES,
  writeBackupFile,
  type DirLike,
  type Permission,
} from './folderBackup.ts'

/** Bellekte çalışan sahte klasör; `shortWrite` iken dosyaya eksik bayt yazar. */
function fakeDir(opts: { permission?: Permission; granted?: Permission; shortWrite?: boolean; failRemove?: boolean } = {}) {
  const files = new Map<string, string>()
  const asked: string[] = []
  const dir: DirLike = {
    name: 'Yedekler',
    async getFileHandle(name) {
      return {
        async createWritable() {
          let pending = ''
          return {
            async write(data: string) {
              pending = data
            },
            async close() {
              files.set(name, opts.shortWrite ? pending.slice(0, 3) : pending)
            },
          }
        },
        async getFile() {
          return { size: new TextEncoder().encode(files.get(name) ?? '').length }
        },
      }
    },
    async removeEntry(name) {
      if (opts.failRemove) throw new Error('silinemedi')
      files.delete(name)
    },
    async *values() {
      for (const name of files.keys()) yield { kind: 'file', name }
      yield { kind: 'directory', name: 'monk-mode-otomatik-2000-01-01.json' }
    },
    async queryPermission() {
      return opts.permission ?? 'granted'
    },
    async requestPermission() {
      asked.push('asked')
      return opts.granted ?? 'granted'
    },
  }
  return { dir, files, asked }
}

describe('dosya adı ve temizlik', () => {
  it('gün başına tek dosya adı üretir (yerel gün)', () => {
    expect(backupFileName(new Date(2026, 9, 5, 23, 59))).toBe('monk-mode-otomatik-2026-10-05.json')
  })

  it('yalnız kendi adımızdaki en eski dosyaları siler, başkasının dosyasına dokunmaz', () => {
    const mine = Array.from({ length: KEEP_FILES + 2 }, (_, i) => `monk-mode-otomatik-2026-10-${String(i + 1).padStart(2, '0')}.json`)
    const others = ['monk-mode-yedek-2026-10-01.json', 'notlar.txt', 'monk-mode-otomatik-eski.json']
    expect(filesToPrune([...others, ...mine])).toEqual([mine[1], mine[0]])
    expect(filesToPrune(mine.slice(0, KEEP_FILES))).toEqual([])
  })
})

describe('yazma izni', () => {
  it('izin verilmişse sormadan geçer; verilmemişse yalnız jestle sorulur', async () => {
    const granted = fakeDir()
    expect(await ensurePermission(granted.dir, false)).toBe(true)
    expect(granted.asked).toEqual([])

    const lapsed = fakeDir({ permission: 'prompt' })
    expect(await ensurePermission(lapsed.dir, false)).toBe(false)
    expect(lapsed.asked).toEqual([])
    expect(await ensurePermission(lapsed.dir, true)).toBe(true)
    expect(lapsed.asked).toHaveLength(1)

    const denied = fakeDir({ permission: 'prompt', granted: 'denied' })
    expect(await ensurePermission(denied.dir, true)).toBe(false)
  })
})

describe('yedek dosyası yazma', () => {
  const NOW = new Date(2026, 9, 20, 12)

  it('günün dosyasına yazar, aynı gün tekrar yazınca üzerine yazar', async () => {
    const { dir, files } = fakeDir()
    expect(await writeBackupFile(dir, '{"a":1}', NOW)).toBe('monk-mode-otomatik-2026-10-20.json')
    await writeBackupFile(dir, '{"a":2}', NOW)
    expect([...files]).toEqual([['monk-mode-otomatik-2026-10-20.json', '{"a":2}']])
  })

  it('Türkçe karakterlerde bayt boyutunu doğru karşılaştırır', async () => {
    const { dir } = fakeDir()
    await expect(writeBackupFile(dir, '{"ad":"Çalışma İğne"}', NOW)).resolves.toBeTruthy()
  })

  it('eksik yazılan dosyada hata fırlatır', async () => {
    const { dir } = fakeDir({ shortWrite: true })
    await expect(writeBackupFile(dir, '{"uzun":"metin"}', NOW)).rejects.toThrow('eksik')
  })

  it('eski dosyaları temizler; temizlik hatası yedeği bozmaz', async () => {
    const { dir, files } = fakeDir()
    for (let day = 1; day <= KEEP_FILES + 3; day++) {
      await writeBackupFile(dir, '{}', new Date(2026, 8, day, 12))
    }
    expect(files.size).toBe(KEEP_FILES)
    expect(files.has('monk-mode-otomatik-2026-09-01.json')).toBe(false)

    const stuck = fakeDir({ failRemove: true })
    for (let day = 1; day <= KEEP_FILES + 1; day++) {
      await expect(writeBackupFile(stuck.dir, '{}', new Date(2026, 8, day, 12))).resolves.toBeTruthy()
    }
  })
})
