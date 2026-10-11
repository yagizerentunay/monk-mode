/**
 * Kayıt kısıcı. Her store değişikliğinde tüm veri JSON'a çevrilip localStorage'a yazılıyordu; 3 yıllık
 * sentetik geçmişte (~600 KB) bu 4× yavaşlatılmış mobil Chrome'da değişiklik başına ~16 ms, yani yazarken
 * her tuşta bir kare kaybıydı. Şimdi:
 * - Sakin anda gelen değişiklik HEMEN yazılır (tek dokunuşluk işlemler eskisi gibi anında kalıcı).
 * - Ardından `everyMs` içinde gelenler birikir ve süre dolunca tek seferde yazılır (son hâl kaybolmaz).
 * - `flush()` bekleyen kaydı hemen yazar; sayfa gizlenirken/kapanırken çağrılır.
 */
export interface SaveScheduler {
  /** Store değişti. */
  notify(): void
  /** Bekleyen kayıt varsa hemen yaz. */
  flush(): void
}

export interface SchedulerDeps {
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export function createSaveScheduler(write: () => void, everyMs: number, deps: SchedulerDeps = {}): SaveScheduler {
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  let last = -Infinity
  let timer: unknown = null

  const run = () => {
    timer = null
    last = now()
    write()
  }

  return {
    notify() {
      if (timer !== null) return // zaten bekleyen bir kayıt var; o an en güncel hâli yazacak
      const wait = last + everyMs - now()
      if (wait <= 0) run()
      else timer = setTimer(run, wait)
    },
    flush() {
      if (timer === null) return
      clearTimer(timer)
      run()
    },
  }
}
