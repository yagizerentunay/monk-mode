import { afterEach, describe, expect, it } from 'vitest'
import { en } from './en.ts'
import { getLang, interpolate, locale, resolveLanguage, setLanguageSetting, setSystemLanguages, t } from './index.ts'
import { tr } from './tr.ts'

afterEach(() => {
  setLanguageSetting('system')
  setSystemLanguages(() => ['tr-TR'])
})

describe('i18n: dil çözümü', () => {
  it("'system' cihaz dili tr ile başlıyorsa Türkçe, değilse İngilizce", () => {
    expect(resolveLanguage('system', ['tr-TR'])).toBe('tr')
    expect(resolveLanguage('system', ['TR'])).toBe('tr')
    expect(resolveLanguage('system', ['en-US', 'tr-TR'])).toBe('en')
    expect(resolveLanguage('system', ['de-DE'])).toBe('en')
    expect(resolveLanguage('system', [])).toBe('en')
  })

  it('açık seçim cihaz dilini ezer', () => {
    expect(resolveLanguage('tr', ['en-US'])).toBe('tr')
    expect(resolveLanguage('en', ['tr-TR'])).toBe('en')
  })

  it('test ortamı varsayılan olarak Türkçeye çözülür', () => {
    expect(getLang()).toBe('tr')
  })

  it('ayar ve cihaz dili değişince geçerli dil ve <html lang> güncellenir', () => {
    setLanguageSetting('en')
    expect(getLang()).toBe('en')
    expect(locale()).toBe('en-US')
    setLanguageSetting('system')
    expect(getLang()).toBe('tr')
    setSystemLanguages(() => ['en-GB'])
    expect(getLang()).toBe('en')
  })
})

describe('i18n: t', () => {
  it('{ad} yer tutucularını doldurur, bilinmeyeni bırakır', () => {
    expect(interpolate('{a} ve {b}', { a: 1 })).toBe('1 ve {b}')
    expect(t('settings.lastBackup', { when: 'dün' }, 'tr')).toBe('Son yedek: dün')
    expect(t('settings.lastBackup', { when: 'yesterday' }, 'en')).toBe('Last backup: yesterday')
  })

  it('İngilizcede 1 için tekil, diğer sayılar için çoğul; Türkçede tek biçim', () => {
    expect(t('count.sets', { n: 1 }, 'en')).toBe('1 set')
    expect(t('count.sets', { n: 3 }, 'en')).toBe('3 sets')
    expect(t('count.sets', { n: 0 }, 'en')).toBe('0 sets')
    expect(t('count.sets', { n: 1 }, 'tr')).toBe('1 set')
    expect(t('count.sets', { n: 3 }, 'tr')).toBe('3 set')
    expect(t('count.workouts', { n: 2 }, 'tr')).toBe('2 antrenman')
  })

  it('dil verilmezse geçerli dili kullanır', () => {
    expect(t('tab.home')).toBe('Ana')
    setLanguageSetting('en')
    expect(t('tab.home')).toBe('Home')
  })
})

describe('i18n: sözlükler', () => {
  it('İngilizce, Türkçedeki anahtarların hepsine ve yalnız onlara sahip', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort())
  })

  it('Türkçe metinlerde çoğul biçim yok, İngilizce metinler boş değil', () => {
    for (const [k, v] of Object.entries(tr)) expect(typeof v, k).toBe('string')
    for (const [k, v] of Object.entries(en)) {
      const forms = typeof v === 'string' ? [v] : [v.one, v.other]
      for (const f of forms) expect(f.trim(), k).not.toBe('')
    }
  })

  it('aynı yer tutucular iki dilde de var', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [k, v] of Object.entries(en)) {
      const trNames = names(tr[k as keyof typeof tr])
      const forms = typeof v === 'string' ? [v] : [v.one, v.other]
      for (const f of forms) expect(names(f).filter((n) => n !== 'n'), k).toEqual(trNames.filter((n) => n !== 'n'))
    }
  })

  it('İngilizce metinlerde Türkçeye özgü harf kalmadı (dilin kendi adı hariç)', () => {
    const allowed = new Set(['settings.language.tr'])
    const bad = Object.entries(en)
      .filter(([k]) => !allowed.has(k))
      .flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [[k, v.one], [k, v.other]]))
      .filter(([, v]) => /[ğüşıöçĞÜŞİÖÇ]/.test(v))
    expect(bad).toEqual([])
  })
})
