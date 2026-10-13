/**
 * Egzersiz veri dosyalarının biçimi ve doğrulaması.
 * - `public/data/exercises.json` ve `public/exercises/*`: Open Exercise Atlas'tan ÜRETİLİR
 *   (`npm run data:atlas`, bkz. docs/atlas-data.md). Elle düzenlenmez; egzersiz eklemek ya da düzeltmek
 *   için Atlas deposu değiştirilir, pin güncellenir (`npm run data:atlas:update`) ve çıktı commit'lenir.
 *   Dönüşüm kuralları `src/lib/atlasAdapter.ts` içindedir.
 * - `public/data/legacy-exercises.json`: kütüphanede artık olmayan eski kimlikler için yalnız ad, kas ve
 *   ekipman. Eski antrenman ve rutin kayıtları adını ve kasını buradan çözer; seçicilerde görünmez.
 *   Bu dosya da aynı komutla üretilir: kütüphaneye geçen kimlikler tablodan düşer.
 * - `data/atlas.lock.json`: kullanılan Atlas commit'i ve dosya özetleri (sha256).
 */
export interface LibraryRecord {
  id: string
  name: string
  /** Aynı hareketin eski ya da yaygın diğer adları; yalnız Strong/Hevy içe aktarma eşleştirmesinde kullanılır. */
  aliases?: string[]
  level: string
  equipment: string | null
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  /**
   * `public/` köküne göreli yol (örn. `exercises/chest.webp`, `.png` da olabilir). Yalnız Atlas'ta
   * görseli olmayan kayıtlarda yoktur.
   */
  illustration?: string
  /** Kurulum ve hareket yönergeleri (Türkçe varsa Türkçe, yoksa İngilizce); en az bir satır. */
  instructions: string[]
}

export interface LegacyRecord {
  id: string
  name: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

/** Kütüphane kayıtlarındaki biçim hatalarını okunur cümlelerle döndürür; boş liste geçerli demektir. */
export function libraryProblems(records: readonly LibraryRecord[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const e of records) {
    const at = e.id || '(kimliksiz)'
    if (!e.id) problems.push('kimliği olmayan kayıt')
    if (ids.has(e.id)) problems.push(`${at}: kimlik tekrarı`)
    ids.add(e.id)
    if (!e.name.trim()) problems.push(`${at}: ad boş`)
    if (names.has(e.name)) problems.push(`${at}: ad tekrarı (${e.name})`)
    names.add(e.name)
    if (e.aliases?.includes(e.name)) problems.push(`${at}: diğer ad asıl adla aynı`)
    if (e.primaryMuscles.length === 0) problems.push(`${at}: birincil kas yok`)
    if (e.illustration !== undefined && !/^exercises\/[a-z0-9-]+\.(webp|png)$/.test(e.illustration)) {
      problems.push(`${at}: görsel yolu geçersiz (${e.illustration})`)
    }
    if (e.instructions.length === 0) problems.push(`${at}: yönerge yok`)
    else if (e.instructions.some((line) => !line.trim())) problems.push(`${at}: boş yönerge satırı`)
  }
  return problems
}
