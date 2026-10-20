import { describe, expect, it } from 'vitest'
import { HINT_SNOOZE_DAYS, isIos, shouldSuggestHomeScreen, type HintEnv } from './homeScreenHint.ts'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 20, 12)

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
const env = (over: Partial<HintEnv> = {}): HintEnv => ({
  userAgent: IPHONE_UA,
  platform: 'iPhone',
  maxTouchPoints: 5,
  standalone: false,
  ...over,
})

describe('iOS tespiti', () => {
  it('iPhone ve iPad kullanıcı aracısını tanır', () => {
    expect(isIos(env())).toBe(true)
    expect(isIos(env({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' }))).toBe(true)
  })

  it('Mac gibi görünen dokunmatik iPadOS bir iOS cihazıdır, dokunmatiksiz Mac ve Android değildir', () => {
    const mac = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' }
    expect(isIos({ ...mac, maxTouchPoints: 5 })).toBe(true)
    expect(isIos({ ...mac, maxTouchPoints: 0 })).toBe(false)
    expect(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)', platform: 'Linux armv81', maxTouchPoints: 5 })).toBe(false)
  })
})

describe('ana ekrana ekle önerisi', () => {
  it('iOS sekmesinde, kaydı olan kullanıcıya gösterilir', () => {
    expect(shouldSuggestHomeScreen(env(), 1, undefined, NOW)).toBe(true)
  })

  it('kayıt yokken, ana ekrandan açılmışken ve iOS değilken gösterilmez', () => {
    expect(shouldSuggestHomeScreen(env(), 0, undefined, NOW)).toBe(false)
    expect(shouldSuggestHomeScreen(env({ standalone: true }), 5, undefined, NOW)).toBe(false)
    expect(shouldSuggestHomeScreen(env({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32', maxTouchPoints: 0 }), 5, undefined, NOW)).toBe(false)
  })

  it('"Anladım" denince 30 gün susar, sonra yine çıkar', () => {
    const at = NOW - (HINT_SNOOZE_DAYS - 1) * DAY
    expect(shouldSuggestHomeScreen(env(), 3, at, NOW)).toBe(false)
    expect(shouldSuggestHomeScreen(env(), 3, NOW - HINT_SNOOZE_DAYS * DAY, NOW)).toBe(true)
  })
})
