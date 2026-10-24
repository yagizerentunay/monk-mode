import { t, type MessageKey } from '../i18n/index.ts'
import { formatDateTime } from './calendar.ts'
import { localizeDecimal } from './units.ts'
import { STORAGE_KEY } from '../store/persist.ts'
import { listSnapshots } from '../store/snapshots.ts'
import { audioState } from './alert.ts'
import { isStandalone } from './homeScreenHint.ts'
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

/** Arayüz dilinin ondalık ayracıyla boyut. */
export function formatBytes(n: number): string {
  const one = (v: number) => localizeDecimal(v.toFixed(1))
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

const AUDIO_TEXT: Record<string, [MessageKey, DiagStatus]> = {
  running: ['diag.audio.running', 'ok'],
  none: ['diag.audio.none', 'info'],
  suspended: ['diag.audio.suspended', 'warn'],
  interrupted: ['diag.audio.interrupted', 'warn'],
  closed: ['diag.audio.closed', 'warn'],
}

/** Tarayıcıdan tanılama satırlarını toplar. */
export async function collectDiagnostics(version: string, lastBackupAt?: number): Promise<DiagRow[]> {
  const rows: DiagRow[] = []
  const add = (label: string, value: string, status: DiagStatus = 'info') => rows.push({ label, value, status })

  add(t('diag.version'), `v${version} · ${currentEntry()?.split('/').pop() ?? t('diag.dev')}`)
  add(t('diag.launch'), isStandalone() ? t('diag.launch.standalone') : t('diag.launch.tab'), isStandalone() ? 'ok' : 'info')
  add(t('diag.connection'), navigator.onLine ? t('diag.online') : t('diag.offline'))

  const sw = await safe<readonly [string, DiagStatus]>(async () => {
    if (!('serviceWorker' in navigator)) return [t('common.unsupported'), 'warn'] as const
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return [t('diag.sw.none'), 'warn'] as const
    return [navigator.serviceWorker.controller ? t('diag.sw.active') : t('diag.sw.next'), 'ok'] as const
  }, [t('diag.unreadable'), 'warn'] as const)
  add(t('diag.offlineMode'), sw[0], sw[1])

  const cached = await safe(async () => {
    if (typeof caches === 'undefined') return null
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys()
      if (keys.some((r) => r.url.endsWith('/data/exercises.json'))) return true
    }
    return false
  }, null)
  if (cached !== null) add(t('diag.cached'), cached ? t('diag.yes') : t('diag.no'), cached ? 'ok' : 'warn')

  const persist = await safe(getPersistStatus, 'unsupported' as const)
  add(
    t('settings.persist'),
    persist === 'persisted' ? t('common.on') : persist === 'not-persisted' ? t('common.off') : t('common.unsupported'),
    persist === 'persisted' ? 'ok' : 'warn',
  )

  const estimate = await safe(async () => (navigator.storage?.estimate ? navigator.storage.estimate() : null), null)
  if (estimate?.usage !== undefined && estimate.quota) {
    add(t('diag.storage'), t('diag.storageValue', { used: formatBytes(estimate.usage), quota: formatBytes(estimate.quota) }))
  }
  const dataSize = await safe(() => localStorage.getItem(STORAGE_KEY)?.length ?? 0, -1)
  add(t('diag.data'), dataSize < 0 ? t('diag.unreadable') : dataSize === 0 ? t('folder.notYet') : formatBytes(dataSize), dataSize >= 0 ? 'info' : 'warn')

  const snaps = await safe(async () => (typeof indexedDB === 'undefined' ? null : await listSnapshots()), null)
  add(
    t('snapshots.title'),
    snaps === null
      ? t('common.unsupported')
      : snaps.length === 0
        ? t('folder.notYet')
        : t('diag.snapshots', { n: snaps.length, last: formatDateTime(snaps[0].at) }),
    snaps === null ? 'warn' : snaps.length > 0 ? 'ok' : 'info',
  )
  add(
    t('diag.lastBackup'),
    lastBackupAt ? formatDateTime(lastBackupAt) : t('settings.never'),
    lastBackupAt ? 'ok' : 'warn',
  )

  const share = await safe(
    () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }),
    false,
  )
  add(t('diag.share'), share ? t('diag.share.yes') : t('diag.share.no'), share ? 'ok' : 'info')

  const audioKnown = AUDIO_TEXT[audioState()]
  const audio: [string, DiagStatus] = audioKnown ? [t(audioKnown[0]), audioKnown[1]] : [audioState(), 'info']
  add(t('diag.restSound'), audio[0], audio[1])
  add(t('diag.vibration'), 'vibrate' in navigator ? t('diag.supported') : t('diag.vibration.no'), 'vibrate' in navigator ? 'ok' : 'info')
  add(t('diag.wakeLock'), 'wakeLock' in navigator ? t('diag.supported') : t('diag.none'), 'wakeLock' in navigator ? 'ok' : 'warn')

  return rows
}

/** Kopyalanacak düz metin rapor. */
export function diagnosticsReport(rows: DiagRow[], userAgent: string, now: Date = new Date()): string {
  return [
    t('diag.reportTitle', { at: now.toISOString() }),
    ...rows.map((r) => `${r.label}: ${r.value}`),
    t('diag.browser', { ua: userAgent }),
  ].join('\n')
}
