import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SetEntry } from '../store/schema.ts'
import { DurationField } from './DurationField.tsx'
import { HoldTimer } from './HoldTimer.tsx'
import { SetRow } from './SetRow.tsx'

const noop = () => {}
const render = (set: SetEntry, extra: { timed?: boolean; unilateral?: boolean; bw?: boolean; bwKg?: number } = {}) =>
  renderToStaticMarkup(
    <SetRow
      name="Set 1"
      badge="1"
      kind="work"
      set={set}
      unilateral={extra.unilateral ?? false}
      unit="kg"
      bw={extra.bw}
      bwKg={extra.bwKg}
      timed={extra.timed}
      canDrop={false}
      onChange={noop}
      onSide={noop}
      onDrop={noop}
      onRemove={noop}
      onCompleted={noop}
    />,
  )

describe('SetRow: süreli set', () => {
  it('tekrar yerine d:ss süre alanı ve kronometre düğmesi gösterir', () => {
    const html = render({ w: 0, r: 90, done: false }, { timed: true })
    expect(html).toContain('aria-label="Set 1 süre"')
    expect(html).toContain('value="1:30"')
    expect(html).not.toContain('tekrar')
    expect(html).toContain('aria-label="Set 1 süre başlat"')
    expect(html).toContain('▶ Süre ölç')
  })

  it('ek yük alanı süreli sette de durur (ağırlıklı plank)', () => {
    const html = render({ w: 10, r: 45, done: false }, { timed: true, bw: true, bwKg: 70 })
    expect(html).toContain('aria-label="Set 1 ek yük"')
    expect(html).toContain('Toplam 80 kg')
    expect(html).toContain('value="0:45"')
  })

  it('tamamlanmış sette kronometre çıkmaz', () => {
    const html = render({ w: 0, r: 45, done: true }, { timed: true })
    expect(html).not.toContain('süre başlat')
    expect(html).toContain('aria-label="Set 1 süre"')
  })

  it('tek taraflıda her taraf için süre alanı ve ayrı kronometre verir', () => {
    const set: SetEntry = { w: 0, r: 30, done: false, sides: { L: { r: 35, done: false }, R: { r: 30, done: false } } }
    const html = render(set, { timed: true, unilateral: true })
    expect(html).toContain('aria-label="Set 1 Sol süre"')
    expect(html).toContain('aria-label="Set 1 Sağ süre"')
    expect(html).toContain('value="0:35"')
    expect(html).toContain('aria-label="Set 1 Sol süre başlat"')
    expect(html).toContain('aria-label="Set 1 Sağ süre başlat"')
    expect(html).toContain('▶ Sol')
  })

  it('tekrarlı sette hiçbir şey değişmez', () => {
    const html = render({ w: 60, r: 8, done: false })
    expect(html).toContain('aria-label="Set 1 tekrar"')
    expect(html).not.toContain('holdrow')
    expect(html).not.toContain('süre')
  })
})

describe('DurationField ve HoldTimer', () => {
  it('süreyi d:ss gösterir', () => {
    expect(renderToStaticMarkup(<DurationField label="Süre" value={125} onChange={noop} />)).toContain('value="2:05"')
  })

  it('bekleyen kronometre başlatma düğmesi olarak çizilir', () => {
    const html = renderToStaticMarkup(<HoldTimer label="Set 2 süre" caption="Sol" onStop={noop} />)
    expect(html).toContain('aria-label="Set 2 süre başlat"')
    expect(html).toContain('▶ Sol')
  })
})
