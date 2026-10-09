import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Exercise } from '../lib/exercises.ts'
import { MuscleFixEditor } from './MuscleFixEditor.tsx'

const base: Exercise = {
  id: 'hip',
  name: 'Cable Hip Adduction',
  level: 'beginner',
  equipment: 'cable',
  category: 'strength',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: [],
  instructions: [],
  images: [],
}

const render = (ex: Exercise) => renderToStaticMarkup(<MuscleFixEditor ex={ex} onClose={() => {}} />)

/** `Etiket` yazan chip'in basılı olup olmadığı. */
const pressed = (html: string, label: string, nth = 0) => {
  const matches = [...html.matchAll(new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*>${label}</button>`, 'g'))]
  return matches[nth]?.[1]
}

describe('MuscleFixEditor', () => {
  it('mevcut kasları seçili getirir (birincil grup önce, yardımcı sonra)', () => {
    const html = render({ ...base, secondaryMuscles: ['glutes'] })
    expect(pressed(html, 'Ön bacak', 0)).toBe('true') // birincil grup
    expect(pressed(html, 'Ön bacak', 1)).toBe('false') // yardımcı grup
    expect(pressed(html, 'Kalça', 1)).toBe('true')
    expect(pressed(html, 'Kalça iç', 0)).toBe('false')
  })

  it('düzeltilmemiş egzersizde "Orijinale dön" yoktur', () => {
    expect(render(base)).not.toContain('Orijinale dön')
  })

  it('düzeltilmiş egzersizde "Orijinale dön" vardır ve düzeltilmiş kaslar seçilidir', () => {
    const html = render({
      ...base,
      primaryMuscles: ['adductors'],
      original: { primary: ['quadriceps'], secondary: [] },
    })
    expect(html).toContain('Orijinale dön')
    expect(pressed(html, 'Kalça iç', 0)).toBe('true')
    expect(pressed(html, 'Ön bacak', 0)).toBe('false')
  })

  it('birincil kas yokken uyarır ve Kaydet kapalıdır', () => {
    const html = render({ ...base, primaryMuscles: [] })
    expect(html).toContain('En az bir birincil kas seç.')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Kaydet<\/button>/)
  })

  it('birincil kas varken Kaydet açıktır ve uyarı yoktur', () => {
    const html = render(base)
    expect(html).not.toContain('En az bir birincil kas seç.')
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Kaydet<\/button>/)
  })
})
