import type { DirLike } from '../lib/folderBackup.ts'

/**
 * Seçilen yedek klasörü ve son klasör yedeğinin izi IndexedDB'de durur: dizin tutamacı (handle) yapısal
 * olarak kopyalanabilir ama localStorage'a yazılamaz. Snapshots deposundan ayrı bir veritabanıdır;
 * o sürümü yükseltmek açık olan sekmeleri kilitleyebilirdi. Cihaza özgüdür, dışa yedeğe girmez.
 */
export interface FolderRecord {
  handle: DirLike
  /** Klasöre son yazılan yedeğin anı (ms) ve veri parmak izi: "yazıldıktan sonra veri değişti mi" için. */
  lastAt?: number
  lastHash?: string
}

const DB_NAME = 'monk-mode-folder'
const STORE = 'kv'
const KEY = 'backup-dir'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function loadFolder(): Promise<FolderRecord | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    await finished(tx)
    return (req.result as FolderRecord | undefined) ?? null
  } finally {
    db.close()
  }
}

export async function saveFolder(record: FolderRecord): Promise<void> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record, KEY)
    await finished(tx)
  } finally {
    db.close()
  }
}

export async function clearFolder(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    await finished(tx)
  } finally {
    db.close()
  }
}
