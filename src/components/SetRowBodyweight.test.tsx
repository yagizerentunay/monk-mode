import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SetEntry } from '../store/schema.ts'
import { SetRow } from './SetRow.tsx'

const noop = () => {}
const render = (set: SetEntry, extra: { bw?: boolean; bwKg?: number; unit?: 'kg' | 'lb' } = {}) =>
  renderToStaticMarkup(
    <SetRow
      name="Set 1"
      badge="1"
      kind="work"
      set={set}
      unilateral={false}
      unit={extra.unit ?? 'kg'}
      bw={extra.bw}
      bwKg={extra.bwKg}
      canDrop={false}
      onChange={noop}
      onSide={noop}
      onDrop={noop}
      onRemove={noop}
      onCompleted={noop}
    />,
  )

describe('SetRow: vücut ağırlığı', () => {
  it('bw satırında alan "ek yük" etiketli, toplam yük ipucu görünür ve eksi işareti için metin klavyesi açılır', () => {
    const html = render({ w: 10, r: 5, done: false }, { bw: true, bwKg: 67 })
    expect(html).toContain('aria-label="Set 1 ek yük"')
    expect(html).toContain('Toplam 77 kg')
    expect(html).toContain('inputMode="text"')
  })

  it('asistli ek yükte toplam yük vücut ağırlığından düşer', () => {
    expect(render({ w: -20, r: 5, done: false }, { bw: true, bwKg: 67 })).toContain('Toplam 47 kg')
  })

  it('lb biriminde toplam yük dönüştürülür', () => {
    expect(render({ w: 10, r: 5, done: false }, { bw: true, bwKg: 67, unit: 'lb' })).toContain('Toplam 169.8 lb')
  })

  it('vücut ağırlığı kaydı yoksa toplam ipucu gösterilmez', () => {
    const html = render({ w: 10, r: 5, done: false }, { bw: true })
    expect(html).not.toContain('Toplam')
    expect(html).toContain('ek yük')
  })

  it('normal egzersizde eski görünüm: "ağırlık" etiketi, ipucu yok, ondalık klavye', () => {
    const html = render({ w: 60, r: 5, done: false })
    expect(html).toContain('aria-label="Set 1 ağırlık"')
    expect(html).not.toContain('Toplam')
    expect(html).toContain('inputMode="decimal"')
  })
})
