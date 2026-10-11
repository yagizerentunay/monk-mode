import { create } from 'zustand'
import { migrateWithReport, type MigrateResult } from './migrate.ts'
import { droppedTotal, repairedTotal } from './sanitize.ts'
import { defaultState, type State } from './schema.ts'

export const STORAGE_KEY = 'monk_state_v1'
/** Okunamayan ham verinin yan kopyası: `monk_state_corrupt_<ISO zaman>`. Kullanıcı silmedikçe durur. */
export const CORRUPT_PREFIX = 'monk_state_corrupt_'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>

/** Depolama durumu; State'in parçası değildir, diske yazılmaz. */
export interface StorageStatus {
  /** Son kayıt başarısız oldu (depolama dolu veya kapalı); sonraki başarılı kayıtla temizlenir. */
  saveFailed: boolean
  /** Açılışta okunamayan veri: ham metin ve yan kopyanın anahtarı (kopya yazılamadıysa null). */
  corrupt: { raw: string; key: string | null } | null
  /**
   * Açılışta veri okundu ama bazı kayıtlar bozuktu: atılan/onarılan sayısı, ham metin ve yan kopyanın anahtarı
   * (kopya yazılamadıysa null). Geçerli kayıtlar yüklendi; ham veri yan kopyada durur.
   */
  sanitized: { dropped: number; repaired: number; raw: string; key: string | null } | null
  /** Yan kopya yazılamadı: kullanıcı onaylayana kadar ana anahtarın üstüne yazılmaz. */
  blocked: boolean
}

export const useStorageStatus = create<StorageStatus>(() => ({
  saveFailed: false,
  corrupt: null,
  sanitized: null,
  blocked: false,
}))

/** Aynı ham veri zaten saklıysa onun anahtarını döner (yeniden açılışta kopya çoğalmasın). */
function findCopy(storage: Store, raw: string): string | null {
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k?.startsWith(CORRUPT_PREFIX) && storage.getItem(k) === raw) return k
  }
  return null
}

/** Ham veriyi ana anahtarın üstüne yazılmadan ÖNCE aynen yan anahtara kopyalar; yazılamazsa null. */
function quarantine(storage: Store, raw: string, now: Date): string | null {
  try {
    const existing = findCopy(storage, raw)
    if (existing) return existing
    const key = CORRUPT_PREFIX + now.toISOString()
    storage.setItem(key, raw)
    return key
  } catch {
    return null
  }
}

/**
 * Kayıtlı veriyi okur. Okunamazsa (bozuk JSON ya da migrate hatası) varsayılan state döner ama ham
 * metin önce yan kopyaya alınır; kopya da yazılamazsa save() kullanıcı onaylayana dek ana anahtara dokunmaz.
 * Okunabilir ama bazı kayıtları bozuksa geçerli kayıtlar yüklenir, bozuklar atılır ve ham metin aynı
 * şekilde yan kopyaya alınır (`sanitized` uyarısı).
 */
export function loadState(
  storage: Store,
  now: Date = new Date(),
  migrateFn: (v: unknown) => MigrateResult = migrateWithReport,
): State {
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return defaultState()
  }
  if (!raw) return defaultState()
  let result: MigrateResult
  try {
    result = migrateFn(JSON.parse(raw))
  } catch {
    const key = quarantine(storage, raw, now)
    useStorageStatus.setState({ corrupt: { raw, key }, blocked: key === null })
    return defaultState()
  }
  const dropped = droppedTotal(result.report)
  if (dropped > 0) {
    // Bozuk kayıtlar atıldı: temizlenmiş state ana anahtarın üstüne yazılmadan önce ham veri aynen saklanır.
    const key = quarantine(storage, raw, now)
    useStorageStatus.setState({
      sanitized: { dropped, repaired: repairedTotal(result.report), raw, key },
      blocked: key === null,
    })
  }
  return result.state
}

/** Atılan kayıt uyarısını kapatır. Yan kopya silinmez; kopya yoksa (blocked) kayıt yazmaya izin verir. */
export function dismissSanitized(): void {
  useStorageStatus.setState({ sanitized: null, blocked: false })
}

/** State'i yazar; hata olursa sessizce yutmak yerine durumu işaretler, sonraki başarılı yazma temizler. */
export function saveState(storage: Pick<Storage, 'setItem'>, state: State): void {
  if (useStorageStatus.getState().blocked) return // kopyasız bozuk veri korunur; oturum bellekte sürer
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (useStorageStatus.getState().saveFailed) useStorageStatus.setState({ saveFailed: false })
  } catch {
    // Depolama dolu veya kapalı: oturum bellekte çalışmaya devam eder, kullanıcı uyarılır.
    useStorageStatus.setState({ saveFailed: true })
  }
}

/** Uyarıyı kapatır. Yan kopya silinmez; kopya yoksa (blocked) bozuk verinin üstüne yazmaya izin verir. */
export function dismissCorrupt(): void {
  useStorageStatus.setState({ corrupt: null, blocked: false })
}
