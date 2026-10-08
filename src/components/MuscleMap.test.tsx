import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MuscleMap, type MapMuscle } from './MuscleMap'

const IDS: MapMuscle[] = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes',
  'hamstrings', 'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps',
]
const make = (v: number) => Object.fromEntries(IDS.map((i) => [i, v])) as Record<MapMuscle, number>
const labels = Object.fromEntries(IDS.map((i) => [i, i.toUpperCase()])) as Record<MapMuscle, string>

describe('MuscleMap', () => {
  it('17 kasın hepsini data-muscle olarak çizer', () => {
    const html = renderToStaticMarkup(<MuscleMap levels={make(0)} labels={labels} />)
    for (const id of IDS) expect(html).toContain(`data-muscle="${id}"`)
  })

  it('seviye 1 tam opaklık, seviye 0 sessiz dolgu verir', () => {
    const hot = renderToStaticMarkup(<MuscleMap levels={make(1)} labels={labels} />)
    expect(hot).toContain('fill-opacity="1"')
    expect(hot).toContain('fill="var(--accent)"')
    const cold = renderToStaticMarkup(<MuscleMap levels={make(0)} labels={labels} />)
    expect(cold).toContain('fill="var(--card)"')
    expect(cold).not.toContain('var(--accent)')
  })

  it('NaN ve eksik seviye 0 sayılır, hata atmaz', () => {
    const lv = { ...make(0), chest: NaN } as Record<MapMuscle, number>
    delete (lv as Partial<Record<MapMuscle, number>>).lats
    const html = renderToStaticMarkup(<MuscleMap levels={lv} labels={labels} />)
    expect(html).not.toContain('NaN')
  })

  it('onSelect verilince bölgeler düğme olur, yoksa dekoratiftir', () => {
    const on = renderToStaticMarkup(<MuscleMap levels={make(0.5)} labels={labels} selected="chest" onSelect={() => {}} />)
    expect(on).toContain('role="button"')
    expect(on).toContain('aria-label="CHEST: 50%"')
    const off = renderToStaticMarkup(<MuscleMap levels={make(0.5)} labels={labels} />)
    expect(off).not.toContain('role="button"')
  })
})
