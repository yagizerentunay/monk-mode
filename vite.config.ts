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

/**
 * `version.json`: sürüm ve giriş betiğinin hash'li adı. Açık uygulama bunu ağdan okuyup kendi giriş
 * betiğiyle karşılaştırır; farklıysa "Yeni sürüm hazır" bandı çıkar (src/lib/updateCheck.ts).
 */
function versionFile(): Plugin {
  return {
    name: 'monk-version-file',
    apply: 'build',
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry)
      if (!entry) return
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version, entry: entry.fileName }) + '\n',
      })
    },
  }
}

/**
 * İçerik güvenlik politikası (savunma derinliği): sayfa yalnız kendi dosyalarını ve jsDelivr'deki egzersiz
 * görsellerini yükleyebilir; eklenti, form gönderimi ve <base> değişimi kapalı. Yalnız üretim derlemesine
 * eklenir: geliştirme sunucusu (React yenileme) satır içi betik enjekte eder ve CSP onu engellerdi.
 * Not: React'in `style={{…}}` ile verdiği stiller DOM özelliğiyle yazıldığından 'unsafe-inline' gerekmez.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'monk-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  // Ayarlar'da gösterilen sürüm; tek kaynak package.json (GitHub release etiketi v<sürüm>).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), prefetchChunks(), versionFile(), contentSecurityPolicy()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor parçası Rolldown çalışma zamanı yardımcılarını (__commonJSMin) uygulama parçasından alır;
        // bu döngüde vendor önce çalışıp "not a function" ile çöküyordu. Katı sıra yardımcıları ayrı parçaya ayırır.
        strictExecutionOrder: true,
        // React ve yönlendirici ayrı parçada: uygulama kodu değişince hash'i değişmez, güncellemede yeniden inmez.
        advancedChunks: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|zustand)[\\/]/ }],
        },
      },
    },
  },
})
