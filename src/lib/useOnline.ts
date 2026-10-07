import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Tarayıcının ağ durumu; `navigator.onLine` kesin değildir ama çevrimdışıyı güvenilir bildirir. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
