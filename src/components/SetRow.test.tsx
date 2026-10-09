import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SetEntry } from '../store/schema.ts'
import { SetRow } from './SetRow.tsx'

const noop = () => {}
const render = (set: SetEntry, warnZero?: boolean) =>
  renderToStaticMarkup(
    <SetRow
      name="Set 1"
      badge="1"
      kind="work"
      set={set}
      unilateral={false}
      unit="kg"
      canDrop={false}
      onChange={noop}
      onSide={noop}
      onDrop={noop}
      onRemove={noop}
      onCompleted={noop}
      warnZero={warnZero}
    />,
  )

describe('SetRow sıfır ağırlık uyarısı', () => {
  const done: SetEntry = { w: 0, r: 8, done: true }

  it('warnZero ile uyarı satırını ve alan işaretini gösterir', () => {
    const html = render(done, true)
    expect(html).toContain('Ağırlık 0 görünüyor. Yanlışlıkla mı girdin?')
    expect(html).toContain('warnfield')
  })

  it('warnZero yoksa ya da false ise hiçbir şey eklemez', () => {
    for (const html of [render(done), render(done, false)]) {
      expect(html).not.toContain('Yanlışlıkla')
      expect(html).not.toContain('warnfield')
    }
  })

  it('tamamlama düğmesini engellemez (düğme etkin kalır)', () => {
    expect(render(done, true)).not.toContain('disabled')
  })
})
