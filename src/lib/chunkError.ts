/**
 * Tembel yüklenen ekran parçası (lazy chunk) indirilemediğinde tarayıcılar farklı mesajlar verir:
 * Chrome "Failed to fetch dynamically imported module", Safari "Importing a module script failed",
 * Firefox "error loading dynamically imported module", bazı paketleyiciler ChunkLoadError.
 * Çevrimdışıyken ya da güncellemeden hemen sonra eski parça adı sunucuda yokken olur; yeniden render
 * etmek işe yaramaz (React yüklenemeyen modülü önbelleğe alır), sayfayı yenilemek gerekir.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  if (name === 'ChunkLoadError') return true
  const text = typeof message === 'string' ? message : ''
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(
    text,
  )
}
