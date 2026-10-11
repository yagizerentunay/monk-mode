import { STORAGE_KEY } from '../store/persist.ts'
import { listSnapshots } from '../store/snapshots.ts'
import { audioState } from './alert.ts'
import { getPersistStatus } from './persistStorage.ts'
import { currentEntry } from './updateCheck.ts'

/**
 * Ayarlar > Tanılama: telefonda denenmesi gereken özelliklerin (kalıcı depolama, service worker, paylaşım,
 * ses, ekranı açık tutma…) bu cihazda gerçekten çalışıp çalışmadığını tek bakışta gösterir ve
 * kopyalanabilir bir rapor üretir. Hiçbir şeyi değiştirmez; her denetim kendi hatasını yutar.
 */
export type DiagStatus = 'ok' | 'warn' | 'info'

export interface DiagRow {
  label: string
  value: string
  status: DiagStatus
}

const KB = 1024
const MB = 1024 * KB

const GB = 1024 * MB

/** Türkçe ondalık virgüllü boyut. */
export function formatBytes(n: number): string {
  const one = (v: number) => v.toFixed(1).replace('.', ',')
  if (n >= GB) return `${one(n / GB)} GB`
  if (n >= MB) return `${one(n / MB)} MB`
  if (n >= KB) return `${Math.round(n / KB)} KB`
  return `${n} B`
}

async function safe<T>(fn: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

const AUDIO_TEXT: Record<string, [string, DiagStatus]> = {
  running: ['hazır', 'ok'],
  none: ['henüz açılmadı (ekrana bir kez dokun)', 'info'],
  suspended: ['askıda (ekrana dokununca açılır)', 'warn'],
  interrupted: ['kesintiye uğradı (ekrana dokununca açılır)', 'warn'],
  closed: ['kapalı', 'warn'],
}

/** Tarayıcıdan tanılama satırlarını toplar. */
export async function collectDiagnostics(version: string, lastBackupAt?: number): Promise<DiagRow[]> {
  const rows: DiagRow[] = []
  const add = (label: string, value: string, status: DiagStatus = 'info') => rows.push({ label, value, status })

  add('Sürüm', `v${version} · ${currentEntry()?.split('/').pop() ?? 'geliştirme'}`)
  add('Açılış', standalone() ? 'ana ekrandan (uygulama)' : 'tarayıcı sekmesi', standalone() ? 'ok' : 'info')
  add('Bağlantı', navigator.onLine ? 'çevrimiçi' : 'çevrimdışı')

  const sw = await safe<readonly [string, DiagStatus]>(async () => {
    if (!('serviceWorker' in navigator)) return ['desteklenmiyor', 'warn'] as const
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return ['kayıtlı değil', 'warn'] as const
    return [navigator.serviceWorker.controller ? 'etkin, sayfayı kontrol ediyor' : 'kayıtlı, bir sonraki açılışta etkin', 'ok'] as const
  }, ['okunamadı', 'warn'] as const)
  add('Çevrimdışı çalışma', sw[0], sw[1])

  const cached = await safe(async () => {
    if (typeof caches === 'undefined') return null
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys()
      if (keys.some((r) => r.url.endsWith('/data/exercises.json'))) return true
    }
    return false
  }, null)
  if (cached !== null) add('Egzersiz verisi önbellekte', cached ? 'evet' : 'hayır', cached ? 'ok' : 'warn')

  const persist = await safe(getPersistStatus, 'unsupported' as const)
  add(
    'Kalıcı depolama',
    persist === 'persisted' ? 'açık' : persist === 'not-persisted' ? 'kapalı' : 'desteklenmiyor',
    persist === 'persisted' ? 'ok' : 'warn',
  )

  const estimate = await safe(async () => (navigator.storage?.estimate ? navigator.storage.estimate() : null), null)
  if (estimate?.usage !== undefined && estimate.quota) {
    add('Depolama', `${formatBytes(estimate.usage)} kullanılıyor / ${formatBytes(estimate.quota)} sınır`)
  }
  const dataSize = await safe(() => localStorage.getItem(STORAGE_KEY)?.length ?? 0, -1)
  add('Kayıtlı veri', dataSize < 0 ? 'okunamadı' : dataSize === 0 ? 'henüz yok' : formatBytes(dataSize), dataSize >= 0 ? 'info' : 'warn')

  const snaps = await safe(async () => (typeof indexedDB === 'undefined' ? null : await listSnapshots()), null)
  add(
    'Otomatik kopyalar',
    snaps === null
      ? 'desteklenmiyor'
      : snaps.length === 0
        ? 'henüz yok'
        : `${snaps.length} kopya, son: ${new Date(snaps[0].at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}`,
    snaps === null ? 'warn' : snaps.length > 0 ? 'ok' : 'info',
  )
  add(
    'Son dışa yedek',
    lastBackupAt ? new Date(lastBackupAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : 'hiç alınmadı',
    lastBackupAt ? 'ok' : 'warn',
  )

  const share = await safe(
    () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }),
    false,
  )
  add('Dosya paylaşımı', share ? 'destekleniyor (yedek paylaşım menüsüyle)' : 'yok (yedek indirilir)', share ? 'ok' : 'info')

  const audio = AUDIO_TEXT[audioState()] ?? [audioState(), 'info']
  add('Dinlenme sesi', audio[0], audio[1])
  add('Titreşim', 'vibrate' in navigator ? 'destekleniyor' : 'yok (iPhone desteklemez)', 'vibrate' in navigator ? 'ok' : 'info')
  add('Ekranı açık tutma', 'wakeLock' in navigator ? 'destekleniyor' : 'yok', 'wakeLock' in navigator ? 'ok' : 'warn')

  return rows
}

/** Kopyalanacak düz metin rapor. */
export function diagnosticsReport(rows: DiagRow[], userAgent: string, now: Date = new Date()): string {
  return [
    `monk-mode tanılama · ${now.toISOString()}`,
    ...rows.map((r) => `${r.label}: ${r.value}`),
    `Tarayıcı: ${userAgent}`,
  ].join('\n')
}
