import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cspFor } from '../../vite.config.ts'
import { STORAGE_KEY } from '../store/persist.ts'
import { resolveTheme, THEME_COLORS } from './theme.ts'

describe('tema', () => {
  it("'system' cihaz tercihini izler, açık seçim her zaman geçerli", () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('index.html açılış betiği aynı depolama anahtarını ve renkleri kullanır', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    expect(html).toContain(`'${STORAGE_KEY}'`)
    expect(html).toContain(`'${THEME_COLORS.light}'`)
    expect(html).toContain(`'${THEME_COLORS.dark}'`)
  })

  it("CSP satır içi betiğe yalnız hash'iyle izin verir; CRLF ve LF aynı hash'i verir", () => {
    const lf = cspFor('<head><script>\n  a()\n</script><script type="module" src="/x.js"></script></head>')
    const crlf = cspFor('<head><script>\r\n  a()\r\n</script></head>')
    expect(lf).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/)
    expect(lf).toBe(crlf)
    expect(lf).not.toContain('unsafe-inline')
    expect(cspFor('<head></head>')).toContain("script-src 'self';")
  })
})
