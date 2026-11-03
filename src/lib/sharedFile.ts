/**
 * Android'de monk-mode, paylaşım menüsünde hedef olarak görünür (manifest `share_target`). Service worker
 * paylaşılan dosyayı (public/sw.js `receiveShare`) bu önbelleğe koyup uygulamayı `#/settings?aktarim=al`
 * adresine yönlendirir; uygulama açılınca dosyayı buradan alır. Ad ve anahtar sw.js ile aynı olmalı.
 */
const SHARE_CACHE = 'monk-share'
const SHARE_KEY = 'shared-backup'

/** Önbellek anahtarı: sw.js `new URL('shared-backup', scope)`; kapsam uygulamanın taban yolu. */
const keyUrl = (): string => new URL(SHARE_KEY, new URL(import.meta.env.BASE_URL, location.origin)).href

/** Paylaşım menüsünden gelen yedek dosyasını alır ve önbellekten siler; yoksa ya da önbellek kullanılamıyorsa null. */
export async function takeSharedBackup(): Promise<File | null> {
  try {
    if (typeof caches === 'undefined') return null
    const cache = await caches.open(SHARE_CACHE)
    const res = await cache.match(keyUrl())
    if (!res) return null
    await cache.delete(keyUrl())
    const name = decodeURIComponent(res.headers.get('x-file-name') ?? '') || 'backup.json'
    return new File([await res.blob()], name, { type: 'application/json' })
  } catch {
    return null
  }
}
