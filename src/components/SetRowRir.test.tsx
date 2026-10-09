import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SetKind } from '../lib/intensity.ts'
import { makeSides } from '../lib/sets.ts'
import type { SetEntry } from '../store/schema.ts'
import { SetRow } from './SetRow.tsx'

type Props = Parameters<typeof SetRow>[0]

const noop = () => {}
const baseProps = (set: SetEntry, extra: Partial<Props> = {}): Props => ({
  name: 'Set 2',
  badge: '2',
  kind: 'work',
  set,
  unilateral: false,
  unit: 'kg',
  canDrop: false,
  onChange: noop,
  onSide: noop,
  onDrop: noop,
  onRemove: noop,
  onCompleted: noop,
  ...extra,
})
const render = (set: SetEntry, extra: Partial<Props> = {}) => renderToStaticMarkup(<SetRow {...baseProps(set, extra)} />)

/** SetRow kancasızdır: işlevi doğrudan çağırıp dönen ağaçta aria-label'a göre düğme bulunur (DOM gerekmez). */
function findByLabel(node: ReactNode, label: string): ReactElement<{ onClick?: () => void }> | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findByLabel(n, label)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<{ 'aria-label'?: string; children?: ReactNode; onClick?: () => void }>(node)) return undefined
  if (node.props['aria-label'] === label) return node as ReactElement<{ onClick?: () => void }>
  return findByLabel(node.props.children, label)
}

const tap = (props: Props, label: string) => {
  const btn = findByLabel(SetRow(props), label)
  expect(btn, label).toBeDefined()
  btn!.props.onClick!()
}

const doneNoRir: SetEntry = { w: 60, r: 8, done: true }

describe('SetRow RIR hızlı girişi', () => {
  it('RIR boş tamamlanmış çalışma setinde satır vurgulanır; girilince vurgu kalkar', () => {
    expect(render(doneNoRir)).toContain('rirrow rir-need')
    expect(render({ ...doneNoRir, rir: 2 })).not.toContain('rir-need')
  })

  it('"Aynı (N)" önceki set RIR\'i varken ve RIR boşken görünür', () => {
    const html = render(doneNoRir, { prevRir: 2 })
    expect(html).toContain('Aynı (2)')
    expect(html).toContain('aria-label="Set 2 RIR önceki set gibi 2"')
  })

  it('4 ve üstü "Aynı (4+)" yazılır', () => {
    expect(render(doneNoRir, { prevRir: 4 })).toContain('Aynı (4+)')
  })

  it('önceki RIR yoksa görünmez', () => {
    expect(render(doneNoRir)).not.toContain('Aynı')
    expect(render(doneNoRir, { prevRir: undefined })).not.toContain('Aynı')
  })

  it('bu sette RIR zaten girilmişse görünmez', () => {
    expect(render({ ...doneNoRir, rir: 1 }, { prevRir: 2 })).not.toContain('Aynı')
  })

  it('RIR 0 da önceki değer olarak önerilir', () => {
    expect(render(doneNoRir, { prevRir: 0 })).toContain('Aynı (0)')
  })

  it('tamamlanmamış sette görünmez', () => {
    const html = render({ w: 60, r: 8, done: false }, { prevRir: 2 })
    expect(html).not.toContain('Aynı')
    expect(html).not.toContain('RIR')
  })

  it('ısınma ve dropset satırlarında RIR de "Aynı" da yok', () => {
    for (const [kind, extra] of [
      ['warmup', { warmup: true }],
      ['drop', { drop: true }],
    ] as [SetKind, Partial<SetEntry>][]) {
      const html = render({ ...doneNoRir, ...extra }, { kind, prevRir: 2 })
      expect(html).not.toContain('Aynı')
      expect(html).not.toContain('rirlabel')
      expect(html).not.toContain('rir-need')
    }
  })

  it('"Aynı (N)"e dokununca onChange({ rir }) çağrılır', () => {
    const onChange = vi.fn()
    tap(baseProps(doneNoRir, { prevRir: 3, onChange }), 'Set 2 RIR önceki set gibi 3')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ rir: 3 })
  })

  it('"Aynı" 0 değerini de yazar (falsy değer yutulmaz)', () => {
    const onChange = vi.fn()
    tap(baseProps(doneNoRir, { prevRir: 0, onChange }), 'Set 2 RIR önceki set gibi 0')
    expect(onChange).toHaveBeenCalledWith({ rir: 0 })
  })

  it('görüntüleme hiçbir şeyi kendiliğinden yazmaz (otomatik doldurma yok)', () => {
    const onChange = vi.fn()
    render(doneNoRir, { prevRir: 2, onChange })
    SetRow(baseProps(doneNoRir, { prevRir: 2, onChange }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('0-4+ chip\'leri değeri yazar; seçiliye tekrar dokunmak temizler', () => {
    const onChange = vi.fn()
    tap(baseProps(doneNoRir, { onChange }), 'Set 2 RIR 4+')
    expect(onChange).toHaveBeenLastCalledWith({ rir: 4 })
    tap(baseProps({ ...doneNoRir, rir: 1 }, { onChange }), 'Set 2 RIR 1')
    expect(onChange).toHaveBeenLastCalledWith({ rir: undefined })
  })

  it('seçili chip aria-pressed ile işaretlenir', () => {
    const html = render({ ...doneNoRir, rir: 1 })
    expect(html).toMatch(/aria-label="Set 2 RIR 1"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/aria-label="Set 2 RIR 2"[^>]*aria-pressed="false"/)
  })

  it('tek taraflı sette RIR set düzeyinde kalır; iki taraf tamamlanınca satır çıkar', () => {
    const uni: SetEntry = { ...doneNoRir, sides: makeSides(8, true) }
    const html = render(uni, { unilateral: true, prevRir: 1 })
    expect(html).toContain('Aynı (1)')
    expect(html.match(/rirlabel/g)).toHaveLength(1)
    const onChange = vi.fn()
    tap(baseProps(uni, { unilateral: true, prevRir: 1, onChange }), 'Set 2 RIR önceki set gibi 1')
    expect(onChange).toHaveBeenCalledWith({ rir: 1 })
    // Yalnız bir taraf yapılmışsa set henüz tamamlanmadı: RIR satırı yok.
    const half: SetEntry = { ...doneNoRir, done: false, sides: { L: { r: 8, done: true }, R: { r: 8, done: false } } }
    expect(render(half, { unilateral: true, prevRir: 1 })).not.toContain('RIR')
  })
})
