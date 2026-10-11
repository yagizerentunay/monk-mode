import { fingerprint } from '../lib/backupReminder.ts'
import { dayString } from '../lib/workout.ts'
import { exportBackup } from './backup.ts'
import { snapshot, useStore } from './useStore.ts'

function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Yedeği JSON dosyası olarak indirir. Önce "yedeklendi" işaretlenir ki dosyanın içindeki ayarlar
 * kendi zamanını ve veri parmak izini taşısın: yedek geri yüklenince hatırlatma bozuk görünmez.
 */
export function downloadBackup(now: Date = new Date()): void {
  useStore.getState().markBackedUp(now.getTime())
  const text = exportBackup(snapshot(useStore.getState()), now)
  saveFile(`monk-mode-yedek-${dayString(now)}.json`, text, 'application/json')
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

/** Dokunmatik cihazda ve tarayıcı dosya paylaşabiliyorsa paylaşım menüsü; masaüstünde indirme daha doğal. */
function canShareFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches &&
    navigator.canShare({ files: [file] })
  )
}

/**
 * Yedeği cihaz dışına alır: telefonda paylaşım menüsü (Dosyalar, iCloud/Drive, kendine mesaj),
 * yoksa indirme. Paylaşım iptal edilirse "yedeklendi" işaretlenmez. Dosyadaki ayarlar, indirmede
 * olduğu gibi kendi yedek zamanını ve parmak izini taşır; işaret yalnız başarıdan sonra store'a yazılır.
 * Kullanıcı dokunuşuyla çağrılmalı (paylaşım menüsü jest ister).
 */
export async function shareBackup(now: Date = new Date()): Promise<SaveResult> {
  const state = snapshot(useStore.getState())
  const marked = {
    ...state,
    settings: { ...state.settings, lastBackupAt: now.getTime(), lastBackupHash: fingerprint(state), backupSnoozedUntil: undefined },
  }
  const name = `monk-mode-yedek-${dayString(now)}.json`
  const file = new File([exportBackup(marked, now)], name, { type: 'application/json' })
  if (!canShareFile(file)) {
    downloadBackup(now)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file], title: 'monk-mode yedeği' })
  } catch {
    // Kullanıcı vazgeçti (AbortError) ya da paylaşım başarısız: yedek alınmış sayılmaz.
    return 'cancelled'
  }
  useStore.getState().markBackedUp(now.getTime())
  return 'shared'
}

/** Okunamayan kayıtlı verinin ham metnini olduğu gibi indirir (kurtarma ya da inceleme için). */
export function downloadRaw(raw: string, now: Date = new Date()): void {
  saveFile(`monk-mode-bozuk-veri-${dayString(now)}.txt`, raw, 'text/plain')
}
