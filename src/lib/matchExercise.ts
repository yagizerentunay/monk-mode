/**
 * Strong / Hevy egzersiz adlarını kütüphane (free-exercise-db) kayıtlarına eşler.
 *
 * İlke: YANLIŞ eşleşme kullanıcının geçmişini bozar, eşleşmemesi ise sadece özel egzersiz
 * yaratır. Bu yüzden her şüphede `null` döner.
 */

export interface MatchCandidate {
  id: string
  name: string
  equipment?: string | null
}

export interface ExerciseMatch {
  id: string
  name: string
  /** 0..1; 1 = normalize edilmiş jeton kümeleri birebir aynı. */
  score: number
}

/** Bu skorun altı kabul edilmez (ağırlıklı Jaccard). Testlerle ayarlandı. */
const MIN_SCORE = 0.7
/** Birinci ile farklı bir egzersiz olan ikinci aday arasındaki asgari fark; altı belirsizlik sayılır. */
const MIN_MARGIN = 0.1

/**
 * Ad üzerindeki kalıp (ifade) takma adları. Boşluklu, küçük harfli metin üzerinde ve jetonlamadan
 * ÖNCE çalışır; böylece "Pull-Up", "pull up", "Pullups" aynı jetona iner.
 */
const PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpull ?ups?\b/g, 'pullup'],
  [/\bchin ?ups?\b/g, 'chinup'],
  [/\bpush ?ups?\b/g, 'pushup'],
  [/\bsit ?ups?\b/g, 'situp'],
  [/\bstep ?ups?\b/g, 'stepup'],
  [/\bpull ?downs?\b/g, 'pulldown'],
  [/\bpush ?downs?\b/g, 'pushdown'],
  [/\bt bar\b/g, 'tbar'],
  [/\bv bar\b/g, 'vbar'],
  [/\be ?z( curl)? bar\b/g, 'ezbar'],
  [/\b(trap|hex) bar\b/g, 'trapbar'],
  [/\bbody ?weight\b|\bbody only\b/g, 'bodyonly'],
  [/\bmedicine ball\b/g, 'medicineball'],
  [/\b(exercise|swiss|stability|physio) ball\b/g, 'exerciseball'],
  [/\bfoam roll(er)?\b/g, 'foamroll'],
  // Aynı hareketin üç yaygın adı; kütüphane "Shoulder Press" ve "Military Press" karışık kullanıyor.
  [/\boverhead press\b|\bmilitary press\b|\bohp\b/g, 'shoulder press'],
  [/\bromanian deadlifts?\b|\brdl\b/g, 'romanian deadlift'],
  [/\bstiff leg(ged)?\b/g, 'stiff'],
  // Kütüphane eğim varyantlarında "bench" sözcüğünü tutarsız kullanıyor (Incline Dumbbell Press / Incline Bench Press).
  [/\b(incline|decline)( \w+)? bench press\b/g, '$1$2 press'],
  [/\bside lateral raises?\b/g, 'lateral raise'],
  [/\b(one|single) arm(ed)?\b/g, 'onearm'],
  [/\b(one|single) leg(ged)?\b/g, 'oneleg'],
  [/\balternat(e|ing)\b/g, 'alternate'],
  [/\bfl(y|ye|yes|ys|ies)\b/g, 'fly'],
  [/\bskull ?crushers?\b/g, 'skullcrusher'],
  // Türkçe uygulama dilinde Hevy adları yerelleşiyor ("Barfiks", "Oturarak ... V Tutuş"); aksan
  // temizlendikten sonra çalışır, bu yüzden "tutuş" -> "tutus" gibi yazılır.
  [/\bbarfiks\b/g, 'pullup'],
]

/** Tek jeton takma adları (kısaltmalar, yazım hataları). */
const TOKEN_ALIASES: Readonly<Record<string, string>> = {
  db: 'dumbbell',
  dbs: 'dumbbell',
  dumbell: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  bands: 'band',
  // Türkçe ekipman ve konum sözcükleri (aksansız): Dambıl, Halter, Makine, Kablo, Oturarak, Tutuş...
  dambil: 'dumbbell',
  halter: 'barbell',
  makine: 'machine',
  kablo: 'cable',
  oturarak: 'seated',
  ayakta: 'standing',
  yatarak: 'lying',
  egimli: 'incline',
  tutus: 'grip',
}

/** Anlam taşımayan dolgu sözcükleri. Tutuş adları (wide, close...) dolgu DEĞİL, ayırt edicidir. */
const FILLER = new Set(['the', 'a', 'an', 'with', 'on', 'of', 'in', 'and', 'for', 'to', 'from', 'military', 'standard'])

/** Ekipman jetonları. Kural 1 bunlar üzerinden işler. */
const EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
  'band',
  'ezbar',
  'bodyonly',
  'trapbar',
  'medicineball',
  'exerciseball',
  'foamroll',
])

/** free-exercise-db `equipment` değerlerinden jetona. 'other' ve null ekipman belirtmez. */
const FIELD_EQUIPMENT: Readonly<Record<string, string>> = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  kettlebells: 'kettlebell',
  bands: 'band',
  'e-z curl bar': 'ezbar',
  'body only': 'bodyonly',
  'medicine ball': 'medicineball',
  'exercise ball': 'exerciseball',
  'foam roll': 'foamroll',
}

/**
 * Hareketi başka bir egzersize çeviren sözcükler: iki tarafta da AYNI olmak zorunda.
 * "Incline Bench Press" ile "Bench Press" farklı egzersizlerdir; Jaccard bunu yeterince
 * cezalandırmadığı için ( 3/4 = 0.75 ) kümenin eşitliğini sert kural yaptık.
 */
const HARD = new Set([
  'smith', 'assisted', 'weighted', 'incline', 'decline', 'reverse', 'sumo', 'stiff', 'front',
  'seated', 'standing', 'lying', 'hammer', 'preacher', 'concentration', 'alternate', 'onearm',
  'oneleg', 'jump', 'goblet', 'hack', 'bulgarian', 'split', 'deficit', 'romanian', 'behind',
  'pistol', 'sissy', 'zercher', 'overhead', 'rear', 'upright', 'hang',
])

/** Skora az katkı veren (kütüphanede varsayılan olan) sözcükler; varsayılan ağırlık 1. */
const WEIGHT: Readonly<Record<string, number>> = {
  grip: 0.1, medium: 0.1, version: 0.1, attachment: 0.1, bar: 0.1,
  handle: 0.3, straight: 0.3, chest: 0.3, bicep: 0.2,
  wide: 0.5, close: 0.5, narrow: 0.5, neutral: 0.5,
}

function stem(t: string): string {
  if (t.length <= 3) return t
  if (/(ches|shes|sses|xes)$/.test(t)) return t.slice(0, -2)
  if (t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1)
  return t
}

/**
 * Adı karşılaştırma jetonlarına çevirir: aksan/noktalama temizlenir, parantez içi (ekipman ve
 * ayrıntılar: "Cable - Straight Bar") ana adla aynı akışa katılır, takma adlar uygulanır,
 * dolgu atılır, çoğul ek kırpılır. Sıra korunur, tekrarlar atılır.
 */
export function normalizeName(name: string): string[] {
  let s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase()
  s = s.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  for (const [re, to] of PHRASES) s = s.replace(re, to)
  const out: string[] = []
  for (const raw of s.split(' ')) {
    // Tek harfli parçalar ('s', 'v') gürültüdür; tek haneli sayılar ('3/4 Sit-Up') anlam taşır.
    if ((raw.length < 2 && !/\d/.test(raw)) || FILLER.has(raw)) continue
    const t = TOKEN_ALIASES[raw] ?? stem(raw)
    if (!out.includes(t)) out.push(t)
  }
  return out
}

interface Entry {
  cand: MatchCandidate
  /** Ad jetonları. */
  tokens: Set<string>
  /** Ekipman alanından gelen jeton ("" yoksa). */
  fieldEq: string | null
  /** Ad + alan ekipmanı. */
  allEq: Set<string>
  /** Ad ekipman jetonları. */
  nameEq: Set<string>
  hardKey: string
  tokenKey: string
}

const w = (t: string): number => WEIGHT[t] ?? 1
const hardKeyOf = (ts: Iterable<string>): string => [...ts].filter((t) => HARD.has(t)).sort().join(',')

/** İndeksi bir kez kurar; dönen fonksiyon aynı girdi için önbellekten yanıt verir. */
export function buildMatcher(library: readonly MatchCandidate[]): (importedName: string) => ExerciseMatch | null {
  const entries: Entry[] = library.map((cand) => {
    const tokens = new Set(normalizeName(cand.name))
    const fieldEq = (cand.equipment && FIELD_EQUIPMENT[cand.equipment]) || null
    const nameEq = new Set([...tokens].filter((t) => EQUIPMENT.has(t)))
    const allEq = new Set(nameEq)
    if (fieldEq) allEq.add(fieldEq)
    return { cand, tokens, fieldEq, allEq, nameEq, hardKey: hardKeyOf(tokens), tokenKey: [...tokens].sort().join(',') }
  })

  // Ters indeks: yalnız anlamlı (ekipman olmayan, ağırlığı >= 0.3) jetonlar. Ortak "barbell" gibi
  // jetonlarla 876 adayın hepsini taramayız.
  const index = new Map<string, number[]>()
  entries.forEach((e, i) => {
    for (const t of e.tokens) {
      if (EQUIPMENT.has(t) || w(t) < 0.3) continue
      const list = index.get(t)
      if (list) list.push(i)
      else index.set(t, [i])
    }
  })

  const cache = new Map<string, ExerciseMatch | null>()

  function compute(importedName: string): ExerciseMatch | null {
    const imp = normalizeName(importedName)
    if (imp.length === 0) return null
    const impSet = new Set(imp)
    const impEq = new Set(imp.filter((t) => EQUIPMENT.has(t)))
    const impHard = hardKeyOf(imp)

    const seen = new Set<number>()
    for (const t of imp) for (const i of index.get(t) ?? []) seen.add(i)

    const scored: { e: Entry; score: number }[] = []
    for (const i of seen) {
      const e = entries[i]
      if (e.hardKey !== impHard) continue
      // Ad ekipman söylemiyorsa ama aday adı söylüyorsa (Pull Up -> Band Assisted Pull-Up) eşleştirme.
      if (impEq.size === 0 && e.nameEq.size > 0) continue
      // İçe aktarılan addaki ayırt edici her sözcük adayda bulunmalı (Leg Curl, Machine Bicep Curl'e gitmesin).
      if (imp.some((t) => !EQUIPMENT.has(t) && w(t) >= 0.5 && !e.tokens.has(t))) continue
      if (impEq.size > 0) {
        // Kural 1: ekipman belirtilmişse aday da aynı ekipmanı taşımalı; adayın adı başka bir
        // ekipman söylüyorsa ("Reverse Band Bench Press", alan: barbell) da elenir.
        const ok = [...impEq].some((q) => e.allEq.has(q)) || (impEq.has('bodyonly') && e.allEq.size === 0 && e.cand.equipment == null)
        if (!ok) continue
        if ([...e.nameEq].some((q) => !impEq.has(q))) continue
      }
      // Ekipman belirtilmediyse adayın ekipman alanı skora katılmaz (yalnız adındakiler katılır).
      const cTokens = new Set(e.tokens)
      if (impEq.size > 0 && e.fieldEq) cTokens.add(e.fieldEq)
      let inter = 0
      let union = 0
      for (const t of impSet) {
        union += w(t)
        if (cTokens.has(t)) inter += w(t)
      }
      for (const t of cTokens) if (!impSet.has(t)) union += w(t)
      const score = union === 0 ? 0 : inter / union
      if (score >= MIN_SCORE) scored.push({ e, score })
    }
    if (scored.length === 0) return null

    // Kural 5: eşitlikte kısa ad, sonra id.
    scored.sort((a, b) => b.score - a.score || a.e.cand.name.length - b.e.cand.name.length || (a.e.cand.id < b.e.cand.id ? -1 : 1))
    const top = scored[0]
    if (top.score < 1) {
      // Kural 4: aynı jeton kümesine sahip kopya kayıtlar rakip sayılmaz; farklı bir egzersiz yakınsa belirsizdir.
      const rival = scored.find((s) => s.e.tokenKey !== top.e.tokenKey)
      if (rival && top.score - rival.score < MIN_MARGIN) return null
    }
    return { id: top.e.cand.id, name: top.e.cand.name, score: Math.round(top.score * 1000) / 1000 }
  }

  return (importedName) => {
    if (cache.has(importedName)) return cache.get(importedName) ?? null
    const r = compute(importedName)
    cache.set(importedName, r)
    return r
  }
}
