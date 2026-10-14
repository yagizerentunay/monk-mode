import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { cellLabel, heatmapGrid, HEATMAP_WEEKS } from '../lib/frequency.ts'
import type { Workout } from '../store/schema.ts'
import { FrequencyHeatmap } from './FrequencyHeatmap.tsx'
import { findAll, textOf } from './elementTree.ts'

const wk = (d: string, n: number): Workout => ({
  id: d,
  d,
  start: 0,
  name: 'A',
  entries: [{ exId: 'bench', sets: Array.from({ length: n }, () => ({ w: 50, r: 8, done: true })) }],
})
const today = new Date(2026, 9, 15, 12) // Perşembe 15 Ekim 2026

const tree = (workouts: Workout[], weekStart = 1) => FrequencyHeatmap({ grid: heatmapGrid(workouts, today, weekStart), weekStart })
const cells = (t: ReturnType<typeof tree>) => findAll(t, (e) => e.props.role === 'img')

describe('FrequencyHeatmap', () => {
  it('geçmiş ve bugünün hücreleri etiketlidir; gelecek günler gizlidir', () => {
    const t = tree([])
    // 16 hafta x 7 gün - bu haftada bugünden sonraki 3 gün (Cum, Cmt, Paz).
    expect(cells(t)).toHaveLength(HEATMAP_WEEKS * 7 - 3)
    expect(findAll(t, (e) => String(e.props.className).includes('heat-future')).every((e) => e.props['aria-hidden'] === 'true')).toBe(true)
    expect(findAll(t, (e) => String(e.props.className).includes('heat-future'))).toHaveLength(3)
  })

  it('her hücrenin tarih ve set sayısı hem aria-label hem title içindedir', () => {
    const t = tree([wk('2026-10-13', 14)])
    const c = cells(t).find((e) => String(e.props['aria-label']).includes('13 Ekim 2026'))!
    expect(c.props['aria-label']).toBe('Salı, 13 Ekim 2026: 14 set')
    expect(c.props.title).toBe(c.props['aria-label'])
    expect(String(c.props.className)).toContain('heat-l2')
    const empty = cells(t).find((e) => String(e.props['aria-label']).includes('12 Ekim 2026'))!
    expect(empty.props['aria-label']).toBe('Pazartesi, 12 Ekim 2026: antrenman yok')
    expect(String(empty.props.className)).toContain('heat-l0')
  })

  it('kademe sınıfları 1-9, 10-19 ve 20+ için ayrıdır', () => {
    const t = tree([wk('2026-10-12', 9), wk('2026-10-13', 10), wk('2026-10-14', 19), wk('2026-10-15', 20)])
    const level = (day: string) => String(cells(t).find((e) => String(e.props['aria-label']).includes(day))!.props.className)
    expect(level('12 Ekim')).toContain('heat-l1')
    expect(level('13 Ekim')).toContain('heat-l2')
    expect(level('14 Ekim')).toContain('heat-l2')
    expect(level('15 Ekim')).toContain('heat-l3')
  })

  it('bugünün hücresi işaretlidir ve tektir', () => {
    const marked = cells(tree([])).filter((e) => String(e.props.className).includes('heat-today'))
    expect(marked).toHaveLength(1)
    expect(marked[0].props['aria-label']).toContain('15 Ekim 2026')
  })

  it('hücreler odaklanılamaz: tabIndex ve düğme yok (klavye tuzağı olmaz)', () => {
    const t = tree([wk('2026-10-13', 14)])
    expect(findAll(t, (e) => e.type === 'button' || e.props.tabIndex !== undefined || typeof e.props.onClick === 'function')).toHaveLength(0)
  })

  it('gösterge kademeleri sayı aralıklarıyla yazılır (renk tek ipucu değil)', () => {
    const text = textOf(tree([]))
    expect(text).toContain('0')
    expect(text).toContain('1-9')
    expect(text).toContain('10-19')
    expect(text).toContain('20+')
    expect(text).toContain('set / gün')
  })

  it('gün adları hafta başlangıcına göre sıralanır', () => {
    const labels = (ws: number) => findAll(tree([], ws), (e) => e.props.className === 'heat-dows').map((e) => textOf(e))[0]
    expect(labels(1)).toBe('PztÇarCumPaz')
    expect(labels(0)).toBe('PazSalPerCmt')
    expect(labels(6)).toBe('CmtPztÇarCum')
  })

  it('ay etiketleri sütun konumunu taşır', () => {
    const t = tree([])
    const months = findAll(t, (e) => e.props.className === 'heat-months')[0]
    const spans = findAll(months.props.children, (e) => e.type === 'span')
    expect(spans.map((s) => textOf(s))).toEqual(['Tem', 'Ağu', 'Eyl', 'Eki'])
    expect(spans.map((s) => (s.props.style as { gridColumn: number }).gridColumn)).toEqual([2, 6, 11, 15])
  })

  it('sunucu çiziminde gerçek HTML üretir ve yatay taşma yaratacak sabit genişlik yok', () => {
    const html = renderToStaticMarkup(tree([wk('2026-10-13', 14)]))
    expect(html).toContain('role="group"')
    expect(html).toContain('repeat(16, minmax(0, 1fr))')
    expect(html).not.toMatch(/width:\s*\d{3,}px/)
  })
})

describe('cellLabel', () => {
  it('set varsa sayı, yoksa "antrenman yok"', () => {
    expect(cellLabel({ date: '2026-01-01', sets: 3, workouts: 1, level: 1, future: false, isToday: false })).toBe('Perşembe, 1 Ocak 2026: 3 set')
    expect(cellLabel({ date: '2026-01-01', sets: 0, workouts: 0, level: 0, future: false, isToday: false })).toBe('Perşembe, 1 Ocak 2026: antrenman yok')
  })
})
