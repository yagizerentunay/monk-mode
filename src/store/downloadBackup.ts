import { fingerprint } from '../lib/backupReminder.ts'
import { workoutsToCsv } from '../lib/exportCsv.ts'
import { loadExercises } from '../lib/exercises.ts'
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

/** Dosyayı paylaşım menüsüne verir; kullanıcı vazgeçerse ya da paylaşım başarısız olursa 'cancelled'. */
async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch {
    return 'cancelled'
  }
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
  // Kullanıcı vazgeçti (AbortError) ya da paylaşım başarısız: yedek alınmış sayılmaz.
  if ((await shareFile(file, 'monk-mode yedeği')) === 'cancelled') return 'cancelled'
  useStore.getState().markBackedUp(now.getTime())
  return 'shared'
}

/**
 * Antrenman geçmişini Türkçe Excel'in açabileceği CSV olarak kaydeder (bkz. lib/exportCsv.ts): telefonda
 * paylaşım menüsü, yoksa indirme. Egzersiz adları için kütüphane yüklenir; yüklenemezse (çevrimdışı)
 * özel egzersiz adları ve kimlikler kullanılır. Kullanıcı dokunuşuyla çağrılmalı.
 */
export async function exportCsv(now: Date = new Date()): Promise<SaveResult> {
  const { workouts, customEx, settings } = useStore.getState()
  const byId = new Map<string, string>()
  try {
    for (const e of await loadExercises()) byId.set(e.id, e.name)
  } catch {
    // Kütüphane yok: kimliğe düşülür.
  }
  for (const c of customEx) byId.set(c.id, c.name)
  const csv = workoutsToCsv(workouts, { unit: settings.unit, names: (id) => byId.get(id) ?? id })
  const name = `monk-mode-antrenmanlar-${dayString(now)}.csv`
  const file = new File([csv], name, { type: 'text/csv' })
  if (!canShareFile(file)) {
    saveFile(name, csv, 'text/csv')
    return 'downloaded'
  }
  return shareFile(file, 'monk-mode antrenmanları')
}

/** Okunamayan kayıtlı verinin ham metnini olduğu gibi indirir (kurtarma ya da inceleme için). */
export function downloadRaw(raw: string, now: Date = new Date()): void {
  saveFile(`monk-mode-bozuk-veri-${dayString(now)}.txt`, raw, 'text/plain')
}
