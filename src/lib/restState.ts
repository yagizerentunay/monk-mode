/**
 * Dinlenme sayacının bitiş zamanı, sayfa yenilenince ya da başka sekmeye gidip dönünce kaybolmasın diye
 * ayrı bir localStorage anahtarında tutulur. Ana state'e (şema, yedek, içe aktarma) girmez: geçicidir.
 */
export const REST_KEY = 'monk_rest_v1'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStore(): Store | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

/** Sayacı aktif antrenmana bağlı kaydeder; `endsAt` null ise siler. Depolama yazılamıyorsa sessizce atlar. */
export function saveRest(workoutId: string, endsAt: number | null, store: Store | null = defaultStore()): void {
  if (!store) return
  try {
    if (endsAt === null) store.removeItem(REST_KEY)
    else store.setItem(REST_KEY, JSON.stringify({ id: workoutId, endsAt }))
  } catch {
    // dolu ya da engelli depolama: sayaç yalnızca bu açılış boyunca yaşar
  }
}

/**
 * Kayıtlı sayacın bitiş zamanını verir. Başka antrenmana ait, bozuk ya da süresi dolmuş kayıt yok sayılır:
 * dolmuş sayaç geri gelirse "Hazır!" bip sesi yenilenince tekrar çalardı.
 */
export function loadRest(workoutId: string, now: number, store: Store | null = defaultStore()): number | null {
  if (!store) return null
  try {
    const raw = store.getItem(REST_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { id?: unknown; endsAt?: unknown }
    if (v.id !== workoutId || typeof v.endsAt !== 'number' || !Number.isFinite(v.endsAt)) return null
    return v.endsAt > now ? v.endsAt : null
  } catch {
    return null
  }
}
