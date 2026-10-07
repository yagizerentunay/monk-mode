/**
 * Service worker'ı yalnızca üretim derlemesinde kaydeder. Geliştirme sunucusunda önbellek
 * HMR'yi bozar, bu yüzden `npm run dev` sırasında hiçbir şey yapılmaz.
 */
export function registerSW(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((e) => console.warn('Service worker kaydedilemedi:', e))
  })
}
