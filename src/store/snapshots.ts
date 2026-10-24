import { t } from '../i18n/index.ts'
import { fingerprint } from '../lib/backupReminder.ts'
import { exportBackup, importBackup } from './backup.ts'
import type { State } from './schema.ts'

/**
 * Otomatik anlık kopyalar: her antrenman bitişinde ve riskli işlemlerden (yedek yükleme, sıfırlama,
 * geri yükleme) önce verinin tam kopyası IndexedDB'ye yazılır; son MAX_SNAPSHOTS tanesi tutulur.
 * localStorage bozulması, yanlışlıkla sıfırlama ya da hatalı içe aktarmaya karşı korur. Aynı tarayıcı
 * deposunda durduğu için tarayıcı verisi silinirse kopyalar da gider: dışa yedeğin yerini tutmaz.
 */
export const MAX_SNAPSHOTS = 10

const DB_NAME = 'monk-mode'
const STORE = 'snapshots'

export interface SnapshotMeta {
  /** Alındığı an (ms); anahtar. */
  at: number
  /** Neden alındı; Ayarlar'da gösterilir. */
  reason: string
  workouts: number
}

interface SnapshotRecord extends SnapshotMeta {
  hash: string
  /** exportBackup biçiminde tam yedek metni; geri yüklemede importBackup ile doğrulanır. */
  text: string
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'at' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function all(db: IDBDatabase): Promise<SnapshotRecord[]> {
  const tx = db.transaction(STORE, 'readonly')
  const req = tx.objectStore(STORE).getAll()
  await done(tx)
  return (req.result as SnapshotRecord[]).sort((a, b) => b.at - a.at)
}

/**
 * Verinin kopyasını alır. Metin çağrı anında üretilir: hemen ardından state değişse (ör. sıfırlama)
 * kopya değişiklikten önceki hâli taşır. Son kopyayla aynı veriyse yazılmaz. IndexedDB yoksa ya da
 * yazma başarısızsa sessizce false döner: kopya bir güvenlik ağıdır, asıl işi engellememeli.
 */
/**
 * "Aynı veri" denetimi için iz. Yedek parmak izi devam eden antrenmanı içermez; o yüzden ayrıca eklenir:
 * yoksa "devam eden antrenman silinmeden önce" kopyası, bir önceki kopyayla aynı sayılıp yazılmazdı.
 */
function snapshotHash(state: State): string {
  const base = fingerprint(state)
  if (!state.active) return base
  return `${base}+${fingerprint({ workouts: [state.active], routines: [], week: {}, bodyweight: [], customEx: [] })}`
}

export function saveSnapshot(state: State, reason: string, now: Date = new Date()): Promise<boolean> {
  const record: SnapshotRecord = {
    at: now.getTime(),
    reason,
    workouts: state.workouts.length,
    hash: snapshotHash(state),
    text: exportBackup(state, now),
  }
  return (async () => {
    if (typeof indexedDB === 'undefined') return false
    const db = await open()
    try {
      const existing = await all(db)
      if (existing[0]?.hash === record.hash) return false
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put(record)
      for (const old of existing.slice(MAX_SNAPSHOTS - 1)) store.delete(old.at)
      await done(tx)
      return true
    } finally {
      db.close()
    }
  })().catch(() => false)
}

/** Kopyaların özeti, yeniden eskiye. */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await open()
  try {
    return (await all(db)).map(({ at, reason, workouts }) => ({ at, reason, workouts }))
  } finally {
    db.close()
  }
}

/** Kopyayı State'e çevirir (importBackup ile doğrulanır ve migrate edilir); yoksa hata fırlatır. */
export async function loadSnapshot(at: number): Promise<State> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(at)
    await done(tx)
    const record = req.result as SnapshotRecord | undefined
    if (!record) throw new Error(t('snapshots.notFound'))
    return importBackup(record.text)
  } finally {
    db.close()
  }
}
