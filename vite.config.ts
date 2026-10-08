import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Alt yoldan yayın (ör. GitHub Pages: BASE_PATH=/monk-mode/) için taban yol ortam değişkeninden gelir.
// Tanımsızsa '/' kalır; çıktı eskisiyle aynıdır. Başa ve sona eğik çizgi eklenir.
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [react()],
})
