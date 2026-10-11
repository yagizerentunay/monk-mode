import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Alt yoldan yayın (ör. GitHub Pages: BASE_PATH=/monk-mode/) için taban yol ortam değişkeninden gelir.
// Tanımsızsa '/' kalır; çıktı eskisiyle aynıdır. Başa ve sona eğik çizgi eklenir.
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

/**
 * Tembel yüklenen (lazy) parçaları index.html'e `<link rel="prefetch">` olarak ekler. Tarayıcı onları
 * açılışı bekletmeden boşta indirir; service worker index.html'deki /assets/ adreslerini önbelleğe
 * aldığı ve eskileri bu listeye göre temizlediği için (public/sw.js assetUrls/pruneStale) parçalar
 * çevrimdışı da hazır olur.
 */
function prefetchChunks(): Plugin {
  let base = '/'
  return {
    name: 'monk-prefetch-chunks',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        return Object.values(ctx.bundle)
          .filter((f) => f.type === 'chunk' && !f.isEntry && !html.includes(f.fileName))
          .map((f) => ({
            tag: 'link',
            attrs: { rel: 'prefetch', href: base + f.fileName, crossorigin: true },
            injectTo: 'head' as const,
          }))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  // Ayarlar'da gösterilen sürüm; tek kaynak package.json (GitHub release etiketi v<sürüm>).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), prefetchChunks()],
})
