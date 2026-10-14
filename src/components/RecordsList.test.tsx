import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { personalRecords } from '../lib/records.ts'
import type { SetEntry, Workout, WorkoutEntry } from '../store/schema.ts'
import { RecordsList, RECORDS_LIMIT } from './RecordsList.tsx'
import { byText, click, findAll, textOf } from './elementTree.ts'

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => ({ w, r, done: true, ...extra })
const entry = (exId: string, sets: SetEntry[], extra: Partial<WorkoutEntry> = {}): WorkoutEntry => ({ exId, sets, ...extra })
const wk = (id: string, d: string, entries: WorkoutEntry[]): Workout => ({ id, d, start: 0, name: 'A', entries })

const today = new Date(2026, 9, 14, 12)
const nameOf = (id: string) => ({ bench: 'Bench Press', pullup: 'Barfiks', pushup: 'Şınav' })[id] ?? id

function render(workouts: Workout[], o: { showAll?: boolean; unit?: 'kg' | 'lb'; onOpen?: (id: string) => void; onToggleAll?: () => void } = {}) {
  return RecordsList({
    records: personalRecords(workouts),
    nameOf,
    unit: o.unit ?? 'kg',
    today,
    showAll: o.showAll ?? false,
    onToggleAll: o.onToggleAll ?? (() => {}),
    onOpen: o.onOpen ?? (() => {}),
  })
}

describe('RecordsList', () => {
  it('1RM, en ağır set ve tarihleri gösterir; ad çözülür', () => {
    const text = textOf(render([wk('1', '2026-08-03', [entry('bench', [set(100, 5), set(110, 1)])])]))
    expect(text).toContain('Bench Press')
    expect(text).toContain('1RM ≈ 116,7 kg · 100 kg×5 · 3 Ağustos')
    expect(text).toContain('En ağır: 110 kg×1 · 3 Ağustos')
  })

  it('en ağır set 1RM setiyle aynıysa ikinci satır yazılmaz', () => {
    const text = textOf(render([wk('1', '2026-08-03', [entry('bench', [set(100, 5)])])]))
    expect(text).toContain('1RM ≈ 116,7 kg · 100 kg×5')
    expect(text).not.toContain('En ağır')
  })

  it('son 30 günde kırılan rekor rozetlidir, eskisi değildir', () => {
    const text = textOf(render([wk('1', '2026-10-10', [entry('bench', [set(100, 5)])]), wk('2', '2026-08-03', [entry('pullup', [set(0, 10)], { bw: true })])]))
    expect(text.match(/Son 30 günde yeni/g)).toHaveLength(1)
    expect(text.indexOf('Bench Press')).toBeLessThan(text.indexOf('Son 30 günde yeni'))
    expect(text.indexOf('Son 30 günde yeni')).toBeLessThan(text.indexOf('Barfiks'))
  })

  it('en yeni rekor önce gelir', () => {
    const text = textOf(render([wk('1', '2026-08-03', [entry('bench', [set(100, 5)])]), wk('2', '2026-09-03', [entry('pullup', [set(0, 10)], { bw: true })])]))
    expect(text.indexOf('Barfiks')).toBeLessThan(text.indexOf('Bench Press'))
  })

  it('vücut ağırlığı: kayıt yoksa 1RM yerine en iyi tekrar görünür, gizlenmez', () => {
    const text = textOf(render([wk('1', '2026-10-01', [entry('pushup', [set(0, 25)], { bw: true })])]))
    expect(text).toContain('Şınav')
    expect(text).toContain('En iyi: Vücut ağırlığı×25')
    expect(text).not.toContain('1RM')
  })

  it('vücut ağırlığı: ek yük artı işaretiyle, asist eksi işaretiyle yazılır', () => {
    expect(textOf(render([wk('1', '2026-10-01', [entry('pullup', [set(10, 5)], { bw: true, bwKg: 80 })])]))).toContain('+10 kg×5')
    expect(textOf(render([wk('1', '2026-10-01', [entry('pullup', [set(-20, 5)], { bw: true, bwKg: 80 })])]))).toContain('−20 kg×5')
  })

  it('lb ayarında ağırlıklar dönüştürülür', () => {
    const text = textOf(render([wk('1', '2026-10-01', [entry('bench', [set(100, 1)])])], { unit: 'lb' }))
    expect(text).toContain('1RM ≈ 220,5 lb · 220,5 lb×1')
  })

  it('bilinmeyen kimlik ham kimlikle görünür', () => {
    expect(textOf(render([wk('1', '2026-10-01', [entry('mystery', [set(50, 5)])])]))).toContain('mystery')
  })

  it('en çok 8 satır gösterir; "Tümünü gör" kalanını açar', () => {
    const many = Array.from({ length: 11 }, (_, i) => wk(`w${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, [entry(`ex${i}`, [set(50, 5)])]))
    const rows = (showAll: boolean) => findAll(render(many, { showAll }), (e) => e.type === 'button' && String(e.props.className).includes('rec-row'))
    expect(rows(false)).toHaveLength(RECORDS_LIMIT)
    expect(rows(true)).toHaveLength(11)
    expect(textOf(render(many))).toContain('Tümünü gör (11)')
    expect(textOf(render(many, { showAll: true }))).toContain('Daha az göster')
    const toggle = vi.fn()
    click(byText(render(many, { onToggleAll: toggle }), 'Tümünü gör (11)'))
    expect(toggle).toHaveBeenCalledOnce()
  })

  it('sekiz ya da daha az rekorda "Tümünü gör" çıkmaz', () => {
    const few = Array.from({ length: 8 }, (_, i) => wk(`w${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, [entry(`ex${i}`, [set(50, 5)])]))
    expect(textOf(render(few))).not.toContain('Tümünü gör')
  })

  it('satıra dokununca egzersiz kimliğiyle açılır', () => {
    const open = vi.fn()
    const row = findAll(render([wk('1', '2026-10-01', [entry('bench', [set(100, 5)])])], { onOpen: open }), (e) => e.type === 'button')[0]
    click(row)
    expect(open).toHaveBeenCalledWith('bench')
  })

  it('sunucu çiziminde gerçek HTML üretir', () => {
    const html = renderToStaticMarkup(render([wk('1', '2026-10-01', [entry('bench', [set(100, 5)])])]))
    expect(html).toContain('class="exrow rec-row"')
    expect(html).toContain('Bench Press')
  })
})
