import { useEffect } from 'react'
import type { Theme } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Tema `<html data-theme>` ile seçilir; değer ayarın kendisidir ('system' | 'dark' | 'light').
 * 'system'de CSS `prefers-color-scheme` ile karar verir (base.css), bu yüzden JS çalışmasa da doğru tema gelir.
 * Açılıştaki yanıp sönmeyi index.html'deki küçük satır içi betik önler: React yüklenmeden aynı işi yapar.
 * O betik bu modülü içe aktaramaz; renkler ve depolama anahtarı orada da yazılıdır (theme.test.ts eşleşmeyi denetler).
 */

/** Tarayıcı çubuğu rengi (`<meta name="theme-color">`): her temanın `--bg` değeri. */
export const THEME_COLORS = { dark: '#111315', light: '#f3efe9' } as const

const LIGHT_QUERY = '(prefers-color-scheme: light)'

export function resolveTheme(theme: Theme, prefersLight: boolean): 'dark' | 'light' {
  if (theme === 'system') return prefersLight ? 'light' : 'dark'
  return theme
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const resolved = resolveTheme(theme, window.matchMedia?.(LIGHT_QUERY).matches ?? false)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
}

/** Ayar değişince ve 'system'deyken cihaz teması değişince sayfayı ve çubuk rengini günceller. */
export function useThemeSync(): void {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia(LIGHT_QUERY)
    const onChange = () => applyTheme(theme)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
}
