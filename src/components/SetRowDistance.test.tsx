import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SetEntry } from '../store/schema.ts'
import { DurationField } from './DurationField.tsx'
import { SetRow } from './SetRow.tsx'

const noop = () => {}
const render = (set: SetEntry) =>
  renderToStaticMarkup(
    <SetRow
      name="Set 1"
      badge="1"
      kind="work"
      set={set}
      unilateral={false}
      unit="kg"
      distance
      canDrop
      onChange={noop}
      onSide={noop}
      onDrop={noop}
      onRemove={noop}
      onCompleted={noop}
    />,
  )

describe('SetRow: mesafe seti', () => {
  it('ağırlık ve tekrar yerine km ve süre alanı, altında tempo gösterir', () => {
    const html = render({ w: 0, r: 1650, m: 5000, done: false })
    expect(html).toContain('aria-label="Set 1 mesafe"')
    expect(html).toContain('value="5"')
    expect(html).toContain('aria-label="Set 1 süre"')
    expect(html).toContain('value="27:30"')
    expect(html).toContain('Tempo 5:30 /km')
    expect(html).not.toContain('ağırlık')
    expect(html).not.toContain('tekrar')
  })

  it('tamamlanınca RIR ve drop yok, yalnız sil', () => {
    const html = render({ w: 0, r: 1650, m: 5000, done: true })
    expect(html).not.toContain('RIR')
    expect(html).not.toContain('Drop')
    expect(html).toContain('aria-label="Set 1 sil"')
  })

  it('mesafe ya da süre yoksa tempo satırı çıkmaz', () => {
    expect(render({ w: 0, r: 0, m: 5000, done: false })).not.toContain('Tempo')
  })

  it('uzun süre alanı saati gösterir', () => {
    expect(renderToStaticMarkup(<DurationField long value={3930} onChange={noop} />)).toContain('value="1:05:30"')
  })
})
