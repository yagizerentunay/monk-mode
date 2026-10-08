import { dayString } from '../lib/workout.ts'
import { exportBackup } from './backup.ts'
import { snapshot, useStore } from './useStore.ts'

/**
 * Yedeği JSON dosyası olarak indirir. Önce "yedeklendi" işaretlenir ki dosyanın içindeki ayarlar
 * kendi zamanını ve veri parmak izini taşısın: yedek geri yüklenince hatırlatma bozuk görünmez.
 */
export function downloadBackup(now: Date = new Date()): void {
  useStore.getState().markBackedUp(now.getTime())
  const text = exportBackup(snapshot(useStore.getState()), now)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `monk-mode-yedek-${dayString(now)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
