/**
 * iPhone/iPad'de sekmede açılan uygulamanın verisini Safari (WebKit) bir süre kullanılmayınca silebilir
 * (siteyle yaklaşık 7 gün etkileşim yoksa); ana ekrana eklenen web uygulamaları bu temizlikten muaftır.
 * Bu yüzden iOS'ta, sekmede çalışıp kaydı olan kullanıcıya ana ekrana eklemesi önerilir.
 */
export const HINT_SNOOZE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export interface HintEnv {
  userAgent: string
  platform: string
  maxTouchPoints: number
  /** Ana ekrandan açılmış mı (`navigator.standalone` ya da display-mode: standalone). */
  standalone: boolean
}

/** iPhone/iPod/iPad; iPadOS 13+ kendini Mac olarak tanıttığı için dokunmatik Mac de sayılır. */
export function isIos(env: Pick<HintEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
}

/**
 * Öneri gösterilsin mi: iOS, ana ekran dışında, saklanacak antrenman var ve kullanıcı son
 * `HINT_SNOOZE_DAYS` günde "Anladım" demedi.
 */
export function shouldSuggestHomeScreen(
  env: HintEnv,
  workouts: number,
  dismissedAt: number | undefined,
  now: number,
): boolean {
  if (!isIos(env) || env.standalone || workouts < 1) return false
  return dismissedAt === undefined || now - dismissedAt >= HINT_SNOOZE_DAYS * DAY_MS
}

const KEY = 'monk_homescreen_hint'

/** Bu cihazda "Anladım" denen an. Cihaza özgüdür, yedeğe girmez; depolama yoksa/başarısızsa yok sayılır. */
export function readDismissedAt(): number | undefined {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) && n > 0 ? n : undefined
  } catch {
    return undefined
  }
}

export function writeDismissedAt(now: number): void {
  try {
    localStorage.setItem(KEY, String(now))
  } catch {
    // Kalıcı değilse öneri bir sonraki açılışta yine çıkar; bu kabul edilebilir.
  }
}

/** Ana ekrandan (PWA olarak) mı açıldı: `navigator.standalone` (iOS) ya da display-mode: standalone. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

export function currentEnv(): HintEnv {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone(),
  }
}
