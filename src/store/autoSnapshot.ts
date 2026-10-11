import { saveSnapshot } from './snapshots.ts'
import { snapshot, useStore } from './useStore.ts'

/** Store'un şu anki hâlinin otomatik kopyasını alır (bkz. snapshots.ts). Sonucu beklemek gerekmez. */
export function snapshotNow(reason: string): Promise<boolean> {
  return saveSnapshot(snapshot(useStore.getState()), reason)
}
