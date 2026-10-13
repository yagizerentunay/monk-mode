/**
 * Egzersiz veri dosyalarının biçimi ve doğrulaması.
 * - `public/data/exercises.json`: monk-mode'un kendi resimli egzersizleri. Tek kaynaktır; elle (ya da
 *   `.agents/skills/monk-exercise-illustrator` ile) düzenlenir, üretilen bir dosya değildir.
 * - `public/data/legacy-exercises.json`: kütüphanede artık olmayan eski kimlikler için yalnız ad, kas ve
 *   ekipman. Eski antrenman ve rutin kayıtları adını ve kasını buradan çözer; seçicilerde görünmez.
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
  /** `public/` köküne göreli yol (örn. `exercises/chest.webp`). */
  illustration: string
  /** Türkçe kurulum ve hareket yönergeleri. */
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
    if (!/^exercises\/[a-z0-9-]+\.webp$/.test(e.illustration)) problems.push(`${at}: görsel yolu geçersiz (${e.illustration})`)
    if (e.instructions.length === 0) problems.push(`${at}: yönerge yok`)
  }
  return problems
}
