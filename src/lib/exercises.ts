import type { CustomExercise } from '../store/schema.ts'
import { equipmentLabel, muscleLabel } from './labels.ts'
import { applyMuscleFix, type MuscleFix } from './muscleFix.ts'

/** free-exercise-db kaydı (kullandığımız alanlar). */
export interface Exercise {
  id: string
  name: string
  level: string
  equipment: string | null
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
  custom?: boolean
  /** Kullanıcı kasları düzelttiyse düzeltmeden önceki kaslar (kas alanları o zaman düzeltilmiş hâldedir). */
  original?: MuscleFix
}

const IMAGE_CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

export function imageUrl(path: string): string {
  return IMAGE_CDN + path
}

let cache: Promise<Exercise[]> | null = null

/** Egzersiz kütüphanesini bir kez yükler. */
export function loadExercises(): Promise<Exercise[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Egzersiz verisi yüklenemedi (${r.status})`)
      return r.json() as Promise<Exercise[]>
    })
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
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
    instructions: [],
    images: [],
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

/**
 * Egzersiz adının dil etiketi. free-exercise-db adları İngilizcedir; sayfa `tr` olduğu için büyük harfe
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
