import { migrate } from './migrate.ts'
import type { State } from './schema.ts'

const APP_MARK = 'monk-mode'

interface BackupFile {
  app: typeof APP_MARK
  exportedAt: string
  state: State
}

export function exportBackup(state: State, now: Date = new Date()): string {
  const file: BackupFile = { app: APP_MARK, exportedAt: now.toISOString(), state }
  return JSON.stringify(file, null, 2)
}

/** Yedek metnini State'e çevirir; geçersizse anlaşılır bir hata fırlatır. */
export function importBackup(text: string): State {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Dosya geçerli bir JSON değil.')
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { app?: unknown }).app !== APP_MARK) {
    throw new Error('Bu dosya bir monk-mode yedeği değil.')
  }
  return migrate((parsed as { state?: unknown }).state)
}
