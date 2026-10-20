import { fingerprint } from '../lib/backupReminder.ts'
import { currentPermission, ensurePermission, writeBackupFile, type DirLike, type Permission } from '../lib/folderBackup.ts'
import { markedBackupText } from './downloadBackup.ts'
import { clearFolder, loadFolder, saveFolder } from './folderHandle.ts'
import { snapshot, useStore } from './useStore.ts'

type DirectoryPicker = (options?: { id?: string; mode?: 'readwrite' }) => Promise<DirLike>

function picker(): DirectoryPicker | undefined {
  if (typeof window === 'undefined') return undefined
  const fn = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  return typeof fn === 'function' ? fn.bind(window) : undefined
}

/** Klasör seçici yalnız masaüstü Chromium'da var; iPhone/Safari/Firefox'ta kart hiç gösterilmez. */
export function folderBackupSupported(): boolean {
  return picker() !== undefined
}

export interface FolderStatus {
  name: string
  permission: Permission
  /** Klasöre son yedeğin anı; hiç yazılmadıysa yok. */
  lastAt?: number
  /** Son klasör yedeğinden beri veri değişti. */
  dirty: boolean
}

function hasData(): boolean {
  const s = useStore.getState()
  return s.workouts.length > 0 || s.bodyweight.length > 0
}

export async function folderStatus(): Promise<FolderStatus | null> {
  if (!folderBackupSupported()) return null
  const record = await loadFolder().catch(() => null)
  if (!record) return null
  return {
    name: record.handle.name,
    permission: await currentPermission(record.handle),
    lastAt: record.lastAt,
    dirty: record.lastHash !== fingerprint(snapshot(useStore.getState())),
  }
}

/** saved: yazıldı · skipped: gerek yok · needs-permission: izin jest ister · failed: yazılamadı. */
export type FolderResult = 'saved' | 'skipped' | 'needs-permission' | 'failed'

let running: Promise<FolderResult> | null = null

/**
 * Yedeği seçili klasöre yazar. `ask` (kullanıcı jesti) izin penceresini açabilir ve veri değişmemiş olsa
 * da yazar; sessiz çağrı yalnız izin zaten verilmişse ve veri son klasör yedeğinden beri değiştiyse yazar.
 * Hiç antrenman/kilo kaydı yokken sessiz yazmaz: sıfırlanmış ya da bozulmuş boş bir hâl, aynı günün iyi
 * yedeğinin üzerine yazılmasın. Başarıdan sonra "yedeklendi" işaretlenir (hatırlatma susar).
 */
export function backupToFolder({ ask }: { ask: boolean }, now: Date = new Date()): Promise<FolderResult> {
  running ??= run(ask, now).finally(() => {
    running = null
  })
  return running
}

async function run(ask: boolean, now: Date): Promise<FolderResult> {
  try {
    const record = await loadFolder()
    if (!record) return 'skipped'
    if (!ask && !hasData()) return 'skipped'
    const hash = fingerprint(snapshot(useStore.getState()))
    if (!ask && record.lastHash === hash) return 'skipped'
    if (!(await ensurePermission(record.handle, ask))) return 'needs-permission'

    await writeBackupFile(record.handle, markedBackupText(now), now)
    await saveFolder({ handle: record.handle, lastAt: now.getTime(), lastHash: hash })
    useStore.getState().markBackedUp(now.getTime())
    return 'saved'
  } catch {
    return 'failed'
  }
}

/** Sessiz yedek (açılışta, sekme arka plana geçince, antrenman bitince); hatalar yutulur. */
export function autoFolderBackup(): void {
  void backupToFolder({ ask: false })
}

/** Klasör seçtirir ve hemen bir yedek yazar. Kullanıcı vazgeçerse 'cancelled'. Jestle çağrılmalı. */
export async function chooseFolder(): Promise<FolderResult | 'cancelled'> {
  const pick = picker()
  if (!pick) return 'failed'
  let handle: DirLike
  try {
    handle = await pick({ id: 'monk-mode-backup', mode: 'readwrite' })
  } catch {
    return 'cancelled'
  }
  await saveFolder({ handle })
  return backupToFolder({ ask: true })
}

export async function removeFolder(): Promise<void> {
  await clearFolder()
}
