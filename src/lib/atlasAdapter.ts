/**
 * Open Exercise Atlas kayıtlarını Monk Mode'un egzersiz kataloğuna çevirir (saf fonksiyon, dosya ve ağ
 * erişimi yok). `scripts/sync-atlas.ts` bunu çağırıp çıktıyı `public/` altına yazar; kurallar
 * docs/atlas-data.md içinde anlatılır.
 *
 * Kurallar:
 * - Çalışma zamanı kimliği: `legacyIds[0]` varsa o, yoksa `atlas:<id>`. İlk kimlikten sonraki
 *   `legacyIds` eski kimlik tablosuna (ad, kas, ekipman) girer; geçmiş kayıtlar onları çözer.
 * - Ad `name.en`; yönergeler `instructions.tr` doluysa o, yoksa `instructions.en`. Türkçe seçildiyse ve
 *   İngilizce de varsa İngilizce arayüz için ayrıca `instructionsEn` yazılır.
 * - Seviye `difficulty`den (`advanced` -> `expert`), kategori Atlas kategorisinden (`mobility` -> `stretching`).
 * - Ekipman: Atlas kodu -> Monk değeri; bench/mat/pull-up-bar tesis kodudur, listedeki ilk tesis dışı
 *   kod seçilir, yoksa (ya da liste boşsa) `null`.
 * - Kas: `upper-back` -> `middle back`, `lower-back` -> `lower back`, `hip-flexors` -> `hip flexors`,
 *   `tibialis-anterior` -> `calves` (Monk'un ayrı ön kaval kodu yok).
 * - Görsel: `reference` > `finish` > `start` rolündeki ilk dosya, `exercises/<dosya adı>` olarak.
 */
import type { LegacyRecord, LibraryRecord } from './exerciseData.ts'

export type AtlasMediaRole = 'start' | 'finish' | 'animation' | 'reference'

/** Atlas kaydının Monk Mode'un okuduğu alt kümesi (Atlas deposundan içe aktarılmaz). */
export interface AtlasExercise {
  id: string
  name: { en: string; tr?: string }
  aliases?: string[]
  difficulty: string
  category: string
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: { en: string[]; tr?: string[] }
  media?: { path: string; role: AtlasMediaRole | string }[]
  legacyIds?: string[]
}

/** `from`: Atlas deposu köküne göreli yol; `to`: Monk Mode'un `public/` köküne göreli yol. */
export interface MediaCopy {
  from: string
  to: string
}

export interface AtlasCatalog {
  library: LibraryRecord[]
  legacy: LegacyRecord[]
  media: MediaCopy[]
}

export interface AtlasAdapterOptions {
  /** Verilirse seçilen görsellerin yolu bu kümede olmak zorundadır (ör. eşzamanlı okunan dosyalar). */
  mediaFiles?: ReadonlySet<string>
}

const MUSCLE_FROM_ATLAS: ReadonlyMap<string, string> = new Map(Object.entries({
  chest: 'chest',
  'upper-back': 'middle back',
  lats: 'lats',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abdominals: 'abdominals',
  obliques: 'obliques',
  'lower-back': 'lower back',
  glutes: 'glutes',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  calves: 'calves',
  'tibialis-anterior': 'calves',
  adductors: 'adductors',
  abductors: 'abductors',
  traps: 'traps',
  neck: 'neck',
  'hip-flexors': 'hip flexors',
}))

const EQUIPMENT_FROM_ATLAS: ReadonlyMap<string, string> = new Map(Object.entries({
  bodyweight: 'body only',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  band: 'bands',
  kettlebell: 'kettlebells',
  'ez-bar': 'e-z curl bar',
  'exercise-ball': 'exercise ball',
  other: 'other',
}))

/** Ekipman değil, mekân/donanım olan kodlar: Monk ekipmanı olarak seçilmez. */
const FACILITY = new Set(['bench', 'mat', 'pull-up-bar'])

const LEVEL_FROM_ATLAS: ReadonlyMap<string, string> = new Map(Object.entries({
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'expert',
}))

const CATEGORY_FROM_ATLAS: ReadonlyMap<string, string> = new Map(Object.entries({
  strength: 'strength',
  mobility: 'stretching',
  cardio: 'cardio',
}))

const ROLE_ORDER = ['reference', 'finish', 'start'] as const

function fail(id: string, message: string): never {
  throw new Error(`Atlas kaydı ${id}: ${message}`)
}

function codePointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function stringList(id: string, field: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) {
    fail(id, `${field} boş olmayan metinlerden oluşan bir liste olmalı`)
  }
  return value as string[]
}

function mapMuscles(id: string, field: string, value: unknown): string[] {
  return stringList(id, field, value).map((code) => {
    const mapped = MUSCLE_FROM_ATLAS.get(code)
    if (mapped === undefined) fail(id, `${field}: bilinmeyen kas kodu "${code}"`)
    return mapped
  })
}

function mapEquipment(id: string, value: unknown): string | null {
  const codes = stringList(id, 'equipment', value)
  let picked: string | null = null
  for (const code of codes) {
    const mapped = EQUIPMENT_FROM_ATLAS.get(code)
    if (mapped === undefined && !FACILITY.has(code)) fail(id, `bilinmeyen ekipman kodu "${code}"`)
    if (picked === null && mapped !== undefined) picked = mapped
  }
  return picked
}

/**
 * Yönergeler: `instructions` Türkçe varsa Türkçe, yoksa İngilizcedir (eski davranış, Türkçe arayüz bunu okur).
 * Türkçe seçildiyse ve İngilizce de varsa `en` ayrıca döner: İngilizce arayüz onu gösterir. Türkçe yokken
 * `instructions` zaten İngilizcedir, kopya yazılmaz.
 */
function mapInstructions(id: string, value: AtlasExercise['instructions'] | undefined): { lines: string[]; en?: string[] } {
  const tr = value?.tr
  const hasTr = Array.isArray(tr) && tr.length > 0
  const lines = stringList(id, 'instructions', (hasTr ? tr : value?.en) ?? [])
  if (lines.length === 0) fail(id, 'yönerge yok (instructions.tr ve instructions.en boş)')
  const en = hasTr && Array.isArray(value?.en) && value.en.length > 0 ? stringList(id, 'instructions.en', value.en) : undefined
  return en ? { lines, en } : { lines }
}

/** Görsel dosyasını seçer: `reference` > `finish` > `start`; hiçbiri yoksa `null`. */
function pickIllustration(id: string, media: AtlasExercise['media']): string | null {
  if (media === undefined) return null
  if (!Array.isArray(media)) fail(id, 'media bir liste olmalı')
  for (const m of media) {
    if (typeof m?.path !== 'string' || m.path.trim() === '') fail(id, 'media girdisinin dosya yolu yok')
  }
  for (const role of ROLE_ORDER) {
    const hit = media.find((m) => m.role === role)
    if (hit) return hit.path
  }
  return null
}

/**
 * Atlas kayıtlarından Monk Mode kataloğu üretir.
 *
 * @param records Atlas `dist/exercises.json` kayıtları.
 * @param previousLegacy Şu anki eski kimlik tablosu; kütüphaneye geçen kimlikler düşülür, fazladan
 *   `legacyIds` eklenir, geri kalanın sırası korunur.
 * @throws Yinelenen çalışma zamanı kimliği, `custom-` ile başlayan eski kimlik, bilinmeyen kod, görsel
 *   yolu eksik ya da (verilmişse) `mediaFiles` içinde olmayan görsel için.
 */
export function atlasToCatalog(
  records: readonly AtlasExercise[],
  previousLegacy: readonly LegacyRecord[],
  options: AtlasAdapterOptions = {},
): AtlasCatalog {
  const claimed = new Map<string, string>() // kimlik -> sahibi olan Atlas kaydı
  const claim = (key: string, owner: string): void => {
    const other = claimed.get(key)
    if (other !== undefined) {
      fail(owner, other === owner ? `kimlik "${key}" tekrar ediyor` : `"${key}" kimliği ${other} kaydında da var`)
    }
    claimed.set(key, owner)
  }

  const library: LibraryRecord[] = []
  const extras: LegacyRecord[] = []
  const media = new Map<string, MediaCopy>() // hedef yol -> kopya

  for (const r of records) {
    const atlasId = typeof r?.id === 'string' ? r.id.trim() : ''
    if (atlasId === '') throw new Error('Atlas kaydında id yok')
    const at = atlasId
    if (typeof r.name?.en !== 'string' || r.name.en.trim() === '') fail(at, 'name.en boş')

    const legacyIds = r.legacyIds === undefined ? [] : stringList(at, 'legacyIds', r.legacyIds)
    for (const lid of legacyIds) {
      if (lid.startsWith('custom-')) fail(at, `eski kimlik "${lid}" özel egzersiz kimliği gibi başlıyor (custom-)`)
      if (lid.startsWith('atlas:')) fail(at, `eski kimlik "${lid}" atlas: önekini kullanamaz`)
    }
    const id = legacyIds[0] ?? `atlas:${atlasId}`
    claim(id, at)
    for (const lid of legacyIds.slice(1)) claim(lid, at)

    const level = LEVEL_FROM_ATLAS.get(r.difficulty)
    if (level === undefined) fail(at, `bilinmeyen difficulty "${String(r.difficulty)}"`)
    const category = CATEGORY_FROM_ATLAS.get(r.category)
    if (category === undefined) fail(at, `bilinmeyen category "${String(r.category)}"`)

    const equipment = mapEquipment(at, r.equipment)
    const primaryMuscles = mapMuscles(at, 'primaryMuscles', r.primaryMuscles)
    const secondaryMuscles = mapMuscles(at, 'secondaryMuscles', r.secondaryMuscles)
    const { lines: instructions, en: instructionsEn } = mapInstructions(at, r.instructions)

    const aliases = r.aliases === undefined ? [] : stringList(at, 'aliases', r.aliases)

    let illustration: string | undefined
    const from = pickIllustration(at, r.media)
    if (from !== null) {
      const base = from.slice(from.lastIndexOf('/') + 1)
      if (!/^[a-z0-9-]+\.(webp|png)$/.test(base)) {
        fail(at, `görsel dosya adı geçersiz (${base}); küçük harf, rakam, tire ve .webp/.png beklenir`)
      }
      if (options.mediaFiles && !options.mediaFiles.has(from)) fail(at, `görsel dosyası bulunamadı (${from})`)
      const to = `exercises/${base}`
      const other = media.get(to)
      if (other && other.from !== from) fail(at, `görsel adı ${other.from} ile çakışıyor (${to})`)
      media.set(to, { from, to })
      illustration = to
    }

    // Anahtar sırası: id, name, aliases, level, equipment, category, kaslar, illustration, instructions, instructionsEn.
    const rec: LibraryRecord = {
      id,
      name: r.name.en,
      ...(aliases.length > 0 ? { aliases: [...aliases] } : {}),
      level,
      equipment,
      category,
      primaryMuscles,
      secondaryMuscles,
      ...(illustration === undefined ? {} : { illustration }),
      instructions,
      ...(instructionsEn === undefined ? {} : { instructionsEn: [...instructionsEn] }),
    }
    library.push(rec)

    for (const lid of legacyIds.slice(1)) {
      extras.push({ id: lid, name: r.name.en, equipment, primaryMuscles: [...primaryMuscles], secondaryMuscles: [...secondaryMuscles] })
    }
  }

  library.sort((a, b) => codePointCompare(a.name.toLowerCase(), b.name.toLowerCase()) || codePointCompare(a.id, b.id))

  // Eski tablo: kütüphaneye geçen kimlikler düşer; fazladan eski kimlikler yerinde yenilenir, yeniler sona eklenir.
  const owned = new Set(library.map((e) => e.id))
  const byExtra = new Map(extras.map((e) => [e.id, e]))
  const legacy: LegacyRecord[] = []
  const placed = new Set<string>()
  for (const old of previousLegacy) {
    if (owned.has(old.id)) continue
    const next = byExtra.get(old.id)
    legacy.push(next ?? old)
    if (next) placed.add(old.id)
  }
  for (const e of [...extras].sort((a, b) => codePointCompare(a.id, b.id))) {
    if (!placed.has(e.id)) legacy.push(e)
  }

  return { library, legacy, media: [...media.values()].sort((a, b) => codePointCompare(a.to, b.to)) }
}
