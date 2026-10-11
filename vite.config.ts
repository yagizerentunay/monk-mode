import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }

// Alt yoldan yayın (ör. GitHub Pages: BASE_PATH=/monk-mode/) için taban yol ortam değişkeninden gelir.
// Tanımsızsa '/' kalır; çıktı eskisiyle aynıdır. Başa ve sona eğik çizgi eklenir.
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  // Ayarlar'da gösterilen sürüm; tek kaynak package.json (GitHub release etiketi v<sürüm>).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
})
