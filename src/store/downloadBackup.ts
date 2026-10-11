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

/** Okunamayan kayıtlı verinin ham metnini olduğu gibi indirir (kurtarma ya da inceleme için). */
export function downloadRaw(raw: string, now: Date = new Date()): void {
  saveFile(`monk-mode-bozuk-veri-${dayString(now)}.txt`, raw, 'text/plain')
}
