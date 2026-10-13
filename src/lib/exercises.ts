import type { CustomExercise } from '../store/schema.ts'
import type { LegacyRecord, LibraryRecord } from './exerciseData.ts'
import { equipmentLabel, muscleLabel } from './labels.ts'
import { applyMuscleFix, type MuscleFix } from './muscleFix.ts'

/** Uygulamanın gösterdiği egzersiz: kütüphane kaydı, özel egzersiz ya da eski kimlik. */
export interface Exercise {
  id: string
  name: string
  /** Eşleştirme için diğer adlar (bkz. exerciseData.ts). */
  aliases?: string[]
  level: string
  equipment: string | null
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  /** Egzersizin kendi referans görseli (uygulama adresine çevrilmiş); özel ve eski kayıtlarda yoktur. */
  illustration?: string
  /** Türkçe kurulum ve hareket yönergeleri (yalnız kütüphane kayıtlarında). */
  instructions?: string[]
  custom?: boolean
  /** Kütüphaneden çıkarılmış eski kimlik: geçmişte adı ve kası çözülür, seçicilerde çıkmaz. */
  legacy?: boolean
  /** Kullanıcı kasları düzelttiyse düzeltmeden önceki kaslar (kas alanları o zaman düzeltilmiş hâldedir). */
  original?: MuscleFix
}

/** `public/` köküne göreli yolu, uygulamanın yayın adresine (örn. `/monk-mode/`) çevirir. */
function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}

async function fetchJson<T>(file: string, what: string): Promise<T> {
  const r = await fetch(assetUrl(`data/${file}`))
  if (!r.ok) throw new Error(`${what} yüklenemedi (${r.status})`)
  return (await r.json()) as T
}

let cache: Promise<Exercise[]> | null = null

/** Egzersiz kütüphanesini bir kez yükler. */
export function loadExercises(): Promise<Exercise[]> {
  cache ??= fetchJson<LibraryRecord[]>('exercises.json', 'Egzersiz verisi')
    .then((records) => records.map((e): Exercise => ({ ...e, illustration: assetUrl(e.illustration) })))
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
}

let legacyCache: Promise<Exercise[]> | null = null

/** Kütüphanede olmayan eski kimlikleri bir kez yükler (bkz. exerciseData.ts). */
export function loadLegacyExercises(): Promise<Exercise[]> {
  legacyCache ??= fetchJson<LegacyRecord[]>('legacy-exercises.json', 'Eski egzersiz verisi')
    .then((rows) =>
      rows.map((r): Exercise => ({ ...r, level: 'beginner', category: 'strength', legacy: true })),
    )
    .catch((e) => {
      legacyCache = null
      throw e
    })
  return legacyCache
}

export function fromCustom(c: CustomExercise): Exercise {
  return {
    id: c.id,
    name: c.name,
    level: 'beginner',
    equipment: c.equipment || null,
    category: 'strength',
    primaryMuscles: c.primaryMuscles,
    secondaryMuscles: [],
    custom: true,
  }
}

/**
 * Kullanıcının kas düzeltmelerini listeye uygular. Kas haritası, filtre, arama ve değiştirme önerisi
 * hep bu listeden beslendiği için düzeltme her yerde geçerli olur. Düzeltmesiz egzersiz aynı nesnedir.
 */
export function withMuscleFixes(list: Exercise[], fixes: Record<string, MuscleFix>): Exercise[] {
  return list.map((e) => applyMuscleFix(e, Object.hasOwn(fixes, e.id) ? fixes[e.id] : undefined))
}

export interface Catalog {
  /** Seçilebilir egzersizler: özel + kütüphane. */
  list: Exercise[]
  /** Kütüphanede olmayan eski kimlikler (kas düzeltmeleri uygulanmış). */
  legacy: Exercise[]
  /** list + legacy; aynı kimlikte list kazanır. */
  byId: Map<string, Exercise>
}

/** Kütüphane, özel egzersizler ve eski kimliklerden uygulamanın kataloğunu kurar. */
export function buildCatalog(
  custom: CustomExercise[],
  library: Exercise[],
  oldIds: Exercise[],
  fixes: Record<string, MuscleFix>,
): Catalog {
  const list = withMuscleFixes([...custom.map(fromCustom), ...library], fixes)
  const legacy = withMuscleFixes(oldIds, fixes)
  return { list, legacy, byId: new Map([...legacy, ...list].map((e) => [e.id, e])) }
}

/**
 * Egzersiz adının dil etiketi. Kütüphane adları İngilizcedir; sayfa `tr` olduğu için büyük harfe
 * çevirmede "Medium" → "MEDİUM" olur. Özel (kullanıcının yazdığı) adlar sayfa dilinde kalır.
 */
export function nameLang(ex: Pick<Exercise, 'custom'> | undefined): 'en' | undefined {
  return ex && !ex.custom ? 'en' : undefined
}

const UNILATERAL_NAME =
  /\b(one|single)[- ](arm|leg|handed)|unilateral|bulgarian|split squat|\blunges?\b|step[- ]?ups?|pistol|concentration curl|kickback/i

/**
 * Adından tek taraflı olduğu anlaşılan egzersizler için varsayılan öneri (kullanıcı değiştirebilir).
 * "Alternating" egzersizler dahil değil: kollar aynı set içinde dönüşümlü çalışır.
 */
export function isUnilateralName(name: string): boolean {
  return UNILATERAL_NAME.test(name)
}

/** Ekipmanı "vücut ağırlığı" olan egzersiz: rutinde ve antrenmanda varsayılan olarak `bw` (ek yük) açılır. */
export function isBodyOnly(ex: Pick<Exercise, 'equipment'>): boolean {
  return ex.equipment === 'body only'
}

export interface ExerciseFilter {
  query: string
  muscle: string | null
  equipment: string | null
}

/** Aramada büyük/küçük harf ve Türkçe aksan farkını yok sayar: "GÖĞÜS", "gogus" ve "göğüs" aynıdır. */
function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
}

/** Arama metni egzersiz adında, birincil kasın ya da ekipmanın Türkçe etiketinde geçiyorsa eşleşir. */
function matchesQuery(e: Exercise, q: string): boolean {
  return (
    fold(e.name).includes(q) ||
    e.primaryMuscles.some((m) => fold(muscleLabel(m)).includes(q)) ||
    (!!e.equipment && fold(equipmentLabel(e.equipment)).includes(q))
  )
}

export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const q = fold(f.query.trim())
  return list.filter(
    (e) =>
      (!q || matchesQuery(e, q)) &&
      (!f.muscle || e.primaryMuscles.includes(f.muscle)) &&
      (!f.equipment || e.equipment === f.equipment),
  )
}

/** Listedeki benzersiz değerler, sık kullanılandan seyreğe. */
export function facetValues(list: Exercise[], pick: (e: Exercise) => string[]): string[] {
  const counts = new Map<string, number>()
  for (const e of list) for (const v of pick(e)) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}
