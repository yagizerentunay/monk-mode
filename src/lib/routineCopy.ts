import { t } from '../i18n/index.ts'
import type { ExCfg, Routine } from '../store/schema.ts'

/**
 * Addaki "(kopya)" / "(kopya N)" son eki (İngilizcede "(copy)"); kopyanın kopyası "(kopya) (kopya)" olmasın
 * diye atılır. İki dilin eki de tanınır: dil değiştikten sonra kopyalanan rutinde de ek birikmez.
 */
const COPY_SUFFIX = /\s*\((?:kopya|copy)(?: \d+)?\)\s*$/i

const norm = (name: string) => name.trim().toLowerCase()

/**
 * Kopya için kullanılmamış bir ad: "<ad> (kopya)", doluysa "(kopya 2)", "(kopya 3)" …
 * Karşılaştırma büyük/küçük harf ve baştaki/sondaki boşluktan bağımsızdır (bkz. mergeRoutines).
 */
export function copyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map(norm))
  const base = name.replace(COPY_SUFFIX, '').trim() || name.trim() || t('routine.fallbackName')
  let candidate = t('routine.copyName', { name: base })
  for (let n = 2; taken.has(norm(candidate)); n++) candidate = t('routine.copyNameN', { name: base, n })
  return candidate
}

/** Egzersiz ayarının derin kopyası: süperset, ısınma, drop, dinlenme dahil her alan korunur. */
const cloneEx = (cfg: ExCfg): ExCfg => ({ ...cfg })

/**
 * Rutinin kopyasını üretir (girdi değişmez): yeni kimlik, benzersiz ad, derin kopyalanmış egzersizler.
 * Hafta gününe atanmaz; bunu çağıran yalnız rutini ekler, `week`e dokunmaz.
 */
export function duplicateRoutine(source: Routine, existing: readonly Routine[], id: string): Routine {
  return {
    id,
    name: copyName(source.name, existing.map((r) => r.name)),
    ex: source.ex.map(cloneEx),
  }
}
