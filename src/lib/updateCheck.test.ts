import { describe, expect, it } from 'vitest'
import { currentEntry, isUpdate } from './updateCheck.ts'

const doc = (src: string | null) => ({
  querySelector: () => (src === null ? null : ({ getAttribute: () => src } as unknown as Element)),
})

describe('yeni sürüm kontrolü', () => {
  it('çalışan sayfanın giriş betiğini okur', () => {
    expect(currentEntry(doc('/monk-mode/assets/index-abc.js'))).toBe('/monk-mode/assets/index-abc.js')
    expect(currentEntry(doc(null))).toBeNull()
  })

  it('giriş betiği farklıysa güncelleme var', () => {
    const remote = { version: '0.1.0', entry: 'assets/index-new.js' }
    expect(isUpdate('/monk-mode/assets/index-old.js', remote)).toBe(true)
    expect(isUpdate('/assets/index-old.js', remote)).toBe(true)
  })

  it('aynı giriş betiğinde güncelleme yok (taban yol ne olursa olsun)', () => {
    const remote = { version: '0.1.0', entry: 'assets/index-abc.js' }
    expect(isUpdate('/monk-mode/assets/index-abc.js', remote)).toBe(false)
    expect(isUpdate('/assets/index-abc.js', remote)).toBe(false)
    expect(isUpdate('assets/index-abc.js', remote)).toBe(false)
  })

  it('bilgi eksikse yanlış alarm vermez', () => {
    expect(isUpdate(null, { version: '0.1.0', entry: 'assets/index-new.js' })).toBe(false)
    expect(isUpdate('/assets/index-abc.js', null)).toBe(false)
    expect(isUpdate('/assets/index-abc.js', { version: '0.1.0', entry: '' })).toBe(false)
  })

  it('benzer sonlu adı güncellemeyle karıştırmaz', () => {
    expect(isUpdate('/assets/xindex-abc.js', { version: '', entry: 'index-abc.js' })).toBe(true)
  })
})
