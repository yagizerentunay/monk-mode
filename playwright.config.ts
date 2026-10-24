import { defineConfig, devices } from '@playwright/test'

// Uçtan uca testler derlenmiş paket üzerinde çalışır: service worker yalnız üretim derlemesinde kaydolur.
// Testler `*.e2e.ts` adını taşır; vitest bunları almaz.
const PORT = 4173

// Testler "bugün"ü Node'da hesaplar, uygulama tarayıcıda; ikisi aynı saat diliminde olmazsa gece yarısına
// yakın koşularda farklı günü görürler. İkisini de sabitle: yaz saati olmayan İstanbul, gerçek kullanımla aynı.
// Node TZ'yi çalışırken okur; işçi süreçleri bu ortamı devralır.
const TIMEZONE = 'Europe/Istanbul'
process.env.TZ = TIMEZONE

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    timezoneId: TIMEZONE,
    // Arayüz dili varsayılan olarak cihaz dilini izler; testler Türkçe metinleri doğrular. İngilizce
    // testler kendi bağlamlarında `locale: 'en-US'` verir ya da Ayarlar'dan dili seçer.
    locale: 'tr-TR',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    // Hep taze derleme: açık kalmış eski bir preview sunucusu eski paketle test ettirmesin.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
