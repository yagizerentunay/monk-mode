import { dayString } from './workout.ts'

/**
 * Klasöre otomatik yedek (File System Access API; masaüstü Chromium). Kullanıcı bir klasör seçer
 * (ör. OneDrive/Drive/Dropbox ile eşitlenen), uygulama yedeği oraya günlük dosya olarak yazar.
 * Bu dosya yalnız saf mantığı taşır: dizin, ihtiyaç duyduğu küçük arayüzle verilir ki tarayıcısız test edilsin.
 */

/** Tutulan gün sayısı: bundan eski otomatik yedek dosyaları silinir. */
export const KEEP_FILES = 14

const NAME_PATTERN = /^monk-mode-otomatik-\d{4}-\d{2}-\d{2}\.json$/

export type Permission = 'granted' | 'prompt' | 'denied'

interface WritableLike {
  write(data: string): Promise<void>
  close(): Promise<void>
}

export interface FileHandleLike {
  createWritable(): Promise<WritableLike>
  getFile(): Promise<{ size: number }>
}

/** FileSystemDirectoryHandle'ın kullandığımız kısmı (tarayıcı türleri bu API'yi tam taşımaz). */
export interface DirLike {
  readonly name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  removeEntry(name: string): Promise<void>
  values(): AsyncIterable<{ kind: string; name: string }>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<Permission>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<Permission>
}

/** Gün başına tek dosya: aynı gün tekrar yazılırsa üzerine yazılır. */
export function backupFileName(now: Date): string {
  return `monk-mode-otomatik-${dayString(now)}.json`
}

/** Silinecek eski dosyalar: yalnız bizim adımızı taşıyanlar, en yeni `keep` tanesi kalır. */
export function filesToPrune(names: string[], keep: number = KEEP_FILES): string[] {
  return names
    .filter((n) => NAME_PATTERN.test(n))
    .sort()
    .reverse()
    .slice(keep)
}

export async function currentPermission(dir: DirLike): Promise<Permission> {
  if (typeof dir.queryPermission !== 'function') return 'prompt'
  try {
    return await dir.queryPermission({ mode: 'readwrite' })
  } catch {
    return 'prompt'
  }
}

/**
 * Yazma izni var mı; yoksa ve `ask` doğruysa ister (kullanıcı jesti gerekir). Tarayıcı yeniden
 * başlayınca izin 'prompt'a düşebilir, bu yüzden sessiz yedek yalnız izin zaten verilmişse çalışır.
 */
export async function ensurePermission(dir: DirLike, ask: boolean): Promise<boolean> {
  if ((await currentPermission(dir)) === 'granted') return true
  if (!ask || typeof dir.requestPermission !== 'function') return false
  try {
    return (await dir.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return false
  }
}

/**
 * Yedeği günün dosyasına yazar, boyutunu doğrular ve eski dosyaları temizler. Yazma kapanışta
 * tamamlanır (tarayıcı geçici dosyayı yerine koyar), yani yarım dosya kalmaz. Hata fırlatırsa yedek
 * yazılmış sayılmamalıdır; temizlik hatası ise yedeği geçersiz kılmaz.
 */
export async function writeBackupFile(dir: DirLike, text: string, now: Date): Promise<string> {
  const name = backupFileName(now)
  const file = await dir.getFileHandle(name, { create: true })
  const writable = await file.createWritable()
  await writable.write(text)
  await writable.close()
  const expected = new TextEncoder().encode(text).length
  if ((await file.getFile()).size !== expected) throw new Error('Yedek dosyası eksik yazıldı.')

  try {
    const names: string[] = []
    for await (const entry of dir.values()) if (entry.kind === 'file') names.push(entry.name)
    for (const old of filesToPrune(names)) await dir.removeEntry(old)
  } catch {
    // Eski dosyalar kalırsa bir sonraki yedekte yine denenir.
  }
  return name
}
