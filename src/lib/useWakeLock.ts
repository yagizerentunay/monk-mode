import { useEffect, useState } from 'react'

/** 'desteklenmiyor': tarayıcıda API yok; 'bekliyor': kilit şu an tutulmuyor; 'aktif': ekran açık tutuluyor. */
export type WakeLockState = 'aktif' | 'desteklenmiyor' | 'bekliyor'

/** `WakeLockSentinel`in kullandığımız kısmı; testte sahtesi yazılabilsin diye dar tutuldu. */
export interface SentinelLike {
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<SentinelLike> }
}

export interface WakeLockDocument {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export function wakeLockSupported(nav: object): boolean {
  return 'wakeLock' in nav
}

/**
 * Ekran kilidini tutan denetleyici (kanca bunu saran ince bir kabuktur). Oluşturulunca kilidi ister;
 * `dispose()` bırakır. Reddedilen istek sessizce yutulur ve sayfa yeniden görünür olunca tekrar denenir.
 */
export function createWakeLock(
  nav: WakeLockNavigator,
  doc: WakeLockDocument,
  onState: (s: WakeLockState) => void,
): { dispose(): void } {
  if (!nav.wakeLock) {
    onState('desteklenmiyor')
    return { dispose() {} }
  }
  const api = nav.wakeLock
  let sentinel: SentinelLike | null = null
  /** İstek yoldayken ikinci istek açılmasın. */
  let pending = false
  let disposed = false

  const drop = (s: SentinelLike) => {
    try {
      s.release().catch(() => {})
    } catch {
      /* zaten bırakılmış olabilir */
    }
  }

  const acquire = () => {
    if (disposed || sentinel || pending || doc.visibilityState !== 'visible') return
    pending = true
    api.request('screen').then(
      (s) => {
        pending = false
        // İstek yoldayken bileşen kalktıysa geç gelen kilit sızmasın.
        if (disposed) return drop(s)
        sentinel = s
        s.addEventListener('release', () => {
          // Sekme gizlenince tarayıcı kilidi kendisi bırakır; kendi bıraktığımızda sentinel zaten sıfırdır.
          if (sentinel !== s) return
          sentinel = null
          onState('bekliyor')
        })
        onState('aktif')
      },
      () => {
        // Düşük pil, izin yok vb.: akışı bozma, görünürlük değişince yeniden dene.
        pending = false
      },
    )
  }

  doc.addEventListener('visibilitychange', acquire)
  onState('bekliyor')
  acquire()

  return {
    dispose() {
      disposed = true
      doc.removeEventListener('visibilitychange', acquire)
      const s = sentinel
      sentinel = null
      if (s) drop(s)
      onState('bekliyor')
    },
  }
}

/** `active` true iken ekranı uyanık tutar (Screen Wake Lock API); API yoksa hiçbir şey yapmaz. */
export function useWakeLock(active: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>(() =>
    wakeLockSupported(navigator) ? 'bekliyor' : 'desteklenmiyor',
  )
  useEffect(() => {
    if (!active || !wakeLockSupported(navigator)) return
    const lock = createWakeLock(navigator as WakeLockNavigator, document, setState)
    return () => lock.dispose()
  }, [active])
  return state
}
