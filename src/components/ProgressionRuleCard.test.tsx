import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultState } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { ProgressionRuleCard, ProgressionRuleEditor } from './ProgressionRuleCard.tsx'
import { byText, click } from './elementTree.ts'

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('ProgressionRuleCard', () => {
  it('varsayılan olarak temkinli seçili görünür', () => {
    const html = renderToStaticMarkup(<ProgressionRuleCard />)
    expect(html).toContain('Ağırlık artış kuralı')
    expect(html).toMatch(/chip on" aria-pressed="true" style="[^"]*">Temkinli/)
    expect(html).toMatch(/chip" aria-pressed="false" style="[^"]*">Hızlı/)
  })

  it('kayıtlı hızlı kuralı seçili gösterir', () => {
    const html = renderToStaticMarkup(<ProgressionRuleEditor rule="fast" onChange={() => {}} />)
    expect(html).toMatch(/chip on" aria-pressed="true" style="[^"]*">Hızlı/)
  })

  it('seçim ayarlara yazılır; temkinliye dönünce ayar silinir', () => {
    const draw = () =>
      ProgressionRuleEditor({
        rule: useStore.getState().settings.progressionRule,
        onChange: (next) => useStore.getState().setSettings({ progressionRule: next === 'fast' ? 'fast' : undefined }),
      })
    click(byText(draw(), 'Hızlı: tek seans yeter'))
    expect(useStore.getState().settings.progressionRule).toBe('fast')
    click(byText(draw(), 'Temkinli (önerilen): üst sınırda iki seans + RIR ≥ 2'))
    expect(useStore.getState().settings.progressionRule).toBeUndefined()
  })
})
