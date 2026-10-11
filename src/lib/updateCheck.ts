import { useEffect, useState } from 'react'

/**
 * Yeni sürüm bildirimi. Her derleme `version.json` yazar (vite.config.ts versionFile): sürüm ve giriş
 * betiğinin hash'li adı. Giriş adı, içe aktardığı parçaların hash'ini taşıdığı için uygulama kodu
 * değişince değişir. Çalışan sayfanın giriş betiği sunucudakinden farklıysa yeni sürüm yayınlanmıştır.
 * Service worker version.json'u önbelleğe almaz (public/sw.js), yanıt hep ağdan gelir.
 */
export interface RemoteVersion {
  version: string
  entry: string
}

const CHECK_EVERY_MS = 30 * 60 * 1000

/** Çalışan sayfanın giriş betiği (ör. `/monk-mode/assets/index-abc.js`); yoksa null (geliştirme sunucusu). */
export function currentEntry(doc: Pick<Document, 'querySelector'> = document): string | null {
  return doc.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src') ?? null
}

/** Sunucudaki giriş betiği çalışan sayfanınkinden farklı mı. Bilgi eksikse yanlış alarm vermez. */
export function isUpdate(current: string | null, remote: RemoteVersion | null): boolean {
  if (!current || !remote?.entry) return false
  return !current.endsWith(`/${remote.entry}`) && current !== remote.entry
}

export async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<RemoteVersion>
    return typeof data.entry === 'string' ? { version: String(data.version ?? ''), entry: data.entry } : null
  } catch {
    return null // çevrimdışı ya da ağ hatası: sessizce sonraki denemeyi bekle
  }
}

/**
 * Yeni sürüm yayınlandıysa sürüm numarasını döner (aynı sürüm numarasıyla yeni derleme de olabilir).
 * Açılışta, sekmeye dönüldüğünde ve açık kaldıkça 30 dakikada bir kontrol eder; bulunca durur.
 */
export function useUpdateAvailable(): RemoteVersion | null {
  const [update, setUpdate] = useState<RemoteVersion | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD || update) return
    let alive = true
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const remote = await fetchRemoteVersion()
      if (alive && isUpdate(currentEntry(), remote)) setUpdate(remote)
    }
    const onVisible = () => void check()
    void check()
    const timer = setInterval(onVisible, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [update])

  return update
}
