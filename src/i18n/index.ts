import { useSyncExternalStore } from 'react'
import { en, type Plural } from './en.ts'
import { tr, type MessageKey } from './tr.ts'

/**
 * Arayüz dili. Ayar 'system' iken cihazın dili `tr` ile başlıyorsa Türkçe, değilse İngilizce seçilir.
 * Kaynak doğrusu `settings.language`dır; mağaza (store/useStore.ts) değişikliği buraya bildirir. Bu modül
 * mağazayı içe aktarmaz, böylece `src/lib` içindeki saf yardımcılar da aynı `t`yi döngü olmadan kullanır.
 */
export type Lang = 'tr' | 'en'
export type LanguageSetting = 'system' | Lang

export type { MessageKey } from './tr.ts'

export type Params = Record<string, string | number>

const MESSAGES: Record<Lang, Record<MessageKey, string | Plural>> = { tr, en }

/** Cihaz dilleri; testler `setSystemLanguages` ile sabitler (jsdom/Node İngilizce döner). */
let systemLanguages: () => readonly string[] = () => {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : []
}

let setting: LanguageSetting = 'system'
let current: Lang = resolveLanguage(setting)
const listeners = new Set<() => void>()

/** Ayarı ve cihaz dillerini somut dile çevirir: yalnız ilk (en çok tercih edilen) dile bakılır. */
export function resolveLanguage(value: LanguageSetting, languages: readonly string[] = systemLanguages()): Lang {
  if (value === 'tr' || value === 'en') return value
  return (languages[0] ?? '').toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

function update(): void {
  const next = resolveLanguage(setting)
  if (typeof document !== 'undefined') document.documentElement.lang = next
  if (next === current) return
  current = next
  for (const l of listeners) l()
}

/** Mağaza ayar değiştiğinde çağırır. */
export function setLanguageSetting(value: LanguageSetting): void {
  setting = value
  update()
}

/** Test ve cihaz dili değişimi için: cihaz dili kaynağını değiştirir ve dili yeniden çözer. */
export function setSystemLanguages(source: () => readonly string[]): void {
  systemLanguages = source
  update()
}

/** Geçerli (çözülmüş) dil. */
export function getLang(): Lang {
  return current
}

/** `Intl`/`toLocale*` için yerel ayar etiketi. */
export function locale(lang: Lang = current): string {
  return lang === 'tr' ? 'tr-TR' : 'en-US'
}

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {}

function pick(value: string | Plural, lang: Lang, params?: Params): string {
  if (typeof value === 'string') return value
  const n = Number(params?.n ?? 0)
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(locale(lang)))
  return rules.select(n) === 'one' ? value.one : value.other
}

/** `{ad}` yer tutucularını doldurur; bilinmeyen yer tutucu olduğu gibi kalır. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : m))
}

/**
 * Çeviri: `t('home.title')`, `t('sets.count', { n: 3 })`. İngilizcede çoğul biçimli metinler `n`
 * parametresine göre `one`/`other` seçer; Türkçede sayıdan sonra çoğul eki olmadığı için tek biçim vardır.
 */
export function t(key: MessageKey, params?: Params, lang: Lang = current): string {
  return interpolate(pick(MESSAGES[lang][key], lang, params), params)
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Dil değişince yeniden çizer. Kök bileşen (App) kullanır; alt ağaç onunla birlikte yeniden çizilir. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/** Dile abone `t`: dil değişince bileşeni yeniden çizer. */
export function useT(): typeof t {
  useLang()
  return t
}

/**
 * Sabit anahtarlı etiket tablosu (kas, ekipman, ölçü adları…): her değer okunduğu anda geçerli dilde
 * çözülür. Çağıranlar eskisi gibi `TABLO[anahtar]` yazar; `Object.entries` de çalışır.
 */
export function labels<K extends string>(keys: Record<K, MessageKey>): Readonly<Record<K, string>> {
  const out = {} as Record<K, string>
  for (const k of Object.keys(keys) as K[]) Object.defineProperty(out, k, { get: () => t(keys[k]), enumerable: true })
  return out
}
