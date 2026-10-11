import { describe, expect, it } from 'vitest'
import { diagnosticsReport, formatBytes } from './diagnostics.ts'

describe('tanılama', () => {
  it('bayt biçimi', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB')
    expect(formatBytes(10 * 1024 ** 3 + 512 * 1024 ** 2)).toBe('10,5 GB')
  })

  it('rapor: başlık, her satır "etiket: değer", sonda tarayıcı', () => {
    const text = diagnosticsReport(
      [
        { label: 'Sürüm', value: 'v0.4.0', status: 'info' },
        { label: 'Kalıcı depolama', value: 'açık', status: 'ok' },
      ],
      'TestUA/1.0',
      new Date('2026-10-12T08:00:00Z'),
    )
    expect(text.split('\n')).toEqual([
      'monk-mode tanılama · 2026-10-12T08:00:00.000Z',
      'Sürüm: v0.4.0',
      'Kalıcı depolama: açık',
      'Tarayıcı: TestUA/1.0',
    ])
  })
})
