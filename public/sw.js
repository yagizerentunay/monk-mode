// monk-mode service worker: bağımlılıksız, elle yazılmış çevrimdışı önbellek.
// Önbellek şemasını değiştirirsen VERSION'ı artır; eski önbellekler activate'te silinir.
const VERSION = 'v1'
const SHELL = `monk-shell-${VERSION}` // index.html + derlenmiş (hash'li) varlıklar
const DATA = `monk-data-${VERSION}` // egzersiz veri seti
const IMAGES = `monk-img-${VERSION}` // gezilen egzersiz görselleri
const KEEP = [SHELL, DATA, IMAGES]
const MAX_IMAGES = 400
const NAV_TIMEOUT_MS = 3000
// Sunucular `Vary: Origin` döndürebilir; modül betiği istekleri Origin başlığıyla geldiği için
// varsayılan eşleşme önbellekteki dosyayı reddeder. Adres aynıysa içerik aynıdır.
const MATCH = { ignoreVary: true }

const scope = self.registration.scope
const INDEX = new URL('./', scope).href
const EXERCISES = new URL('data/exercises.json', scope).href

function isImageCdn(url) {
  return url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('free-exercise-db')
}

/** index.html içindeki hash'li js/css adreslerini bulur. */
function assetUrls(html) {
  const out = new Set()
  for (const m of html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)) {
    out.add(new URL(m[1], scope).href)
  }
  return [...out]
}

async function precache() {
  const shell = await caches.open(SHELL)
  const res = await fetch(INDEX, { cache: 'reload' })
  if (!res.ok) throw new Error(`index.html alınamadı (${res.status})`)
  const html = await res.clone().text()
  await shell.put(INDEX, res)
  await Promise.all(
    [...assetUrls(html), new URL('favicon.svg', scope).href, new URL('manifest.webmanifest', scope).href].map((u) =>
      shell.add(u).catch(() => {}),
    ),
  )
  // Egzersiz verisi büyük (~1 MB) ve çevrimdışı kütüphane için şart; başarısızsa kurulumu bozma.
  const data = await caches.open(DATA)
  await data.add(EXERCISES).catch(() => {})
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('monk-') && !KEEP.includes(n)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

/** Ağ önce; ağ yoksa veya yavaşsa önbellekteki index.html. */
async function navigate(request) {
  const cache = await caches.open(SHELL)
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(INDEX, res.clone())
    return res
  })
  network.catch(() => {}) // yarıştan sonra reddedilirse işlenmemiş hata olmasın
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS))
  try {
    const res = await Promise.race([network, timeout])
    if (res) return res
  } catch {
    // ağ hatası: önbelleğe düş
  }
  return (await cache.match(INDEX, MATCH)) || network
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, MATCH)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, MATCH)
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  return hit || (await refresh) || Response.error()
}

async function image(request) {
  const cache = await caches.open(IMAGES)
  const hit = await cache.match(request.url, MATCH)
  if (hit) return hit
  // <img> istekleri no-cors gelir ve opak yanıt kotayı şişirir; CDN CORS verdiği için cors ile yeniden iste.
  const res = await fetch(request.url, { mode: 'cors' })
  if (res.ok) {
    await cache.put(request.url, res.clone())
    const keys = await cache.keys()
    if (keys.length > MAX_IMAGES) await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map((k) => cache.delete(k)))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (isImageCdn(url)) {
    event.respondWith(image(request).catch(() => Response.error()))
    return
  }
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL))
  } else if (url.href === EXERCISES) {
    event.respondWith(staleWhileRevalidate(request, DATA))
  } else {
    event.respondWith(staleWhileRevalidate(request, SHELL))
  }
})
