/** Tarayıcıdan kalıcı depolama (navigator.storage.persist) izni: veri, depolama baskısında silinmesin diye. */
export type PersistStatus = 'persisted' | 'not-persisted' | 'unsupported'

function storage(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/** Mevcut durum. API yoksa ya da çağrı hata verirse 'unsupported' (iOS'ta eski sürümlerde persist yok). */
export async function getPersistStatus(): Promise<PersistStatus> {
  const s = storage()
  if (!s || typeof s.persisted !== 'function' || typeof s.persist !== 'function') return 'unsupported'
  try {
    return (await s.persisted()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'unsupported'
  }
}

/** Kalıcılık ister ve sonucu döner. İstek reddedilirse/hata verirse durum 'not-persisted' kalır. */
export async function requestPersist(): Promise<PersistStatus> {
  const s = storage()
  if (!s || typeof s.persist !== 'function') return 'unsupported'
  try {
    return (await s.persist()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'not-persisted'
  }
}

let askedThisSession = false

/**
 * Oturum başına en fazla bir kez ister (Chrome'da tekrar zararsız ama gereksiz). Kullanıcı jestinin
 * (ör. "Antrenmanı bitir" tıklaması) içinde çağır: Safari izni jest sırasında ister; bu yüzden önce
 * persisted() beklenmez, persist() doğrudan çağrılır (zaten kalıcıysa true döner).
 */
export function requestPersistOnce(): Promise<PersistStatus> {
  if (askedThisSession) return getPersistStatus()
  askedThisSession = true
  return requestPersist()
}
