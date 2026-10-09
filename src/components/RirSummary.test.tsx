import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { applyRirToEntry } from '../lib/rir.ts'
import type { SetEntry, Workout } from '../store/schema.ts'
import { tapByLabel } from './reactTree.ts'
import { RirSummary } from './RirSummary.tsx'

const work = (rir?: number): SetEntry => ({ w: 60, r: 8, done: true, ...(rir !== undefined ? { rir } : {}) })
const warmup: SetEntry = { w: 20, r: 8, done: true, warmup: true }

const NAMES: Record<string, string> = { bench: 'Bench Press', row: 'Barbell Row' }

function wk(...entries: [string, SetEntry[]][]): Workout {
  return {
    id: 'w1',
    d: '2026-10-09',
    start: 1,
    end: 2,
    name: 'Push',
    entries: entries.map(([exId, sets]) => ({ exId, sets })),
  }
}

type Props = Parameters<typeof RirSummary>[0]
const props = (workout: Workout, extra: Partial<Props> = {}): Props => ({
  workout,
  describeEx: (id) => ({ name: NAMES[id] ?? id }),
  skipped: false,
  onApply: () => {},
  onSkip: () => {},
  ...extra,
})
/** Kesme işareti HTML'de &#x27; olur; karşılaştırmayı okunur tutmak için geri çevrilir. */
const html = (p: Props) => renderToStaticMarkup(<RirSummary {...p} />).replaceAll('&#x27;', "'")

describe('RirSummary', () => {
  it('eksik varsa sayıyı, kapsamayı ve egzersiz başına satırı gösterir', () => {
    const out = html(props(wk(['bench', [warmup, work(), work(), work(1)]], ['row', [work()]])))
    expect(out).toContain('RIR eksik: 3 set')
    expect(out).toContain("Bu antrenmanda setlerin %25'inde RIR var")
    expect(out).toContain('Bench Press')
    expect(out).toContain('Barbell Row')
    expect(out).toContain('2 set')
    expect(out).toContain('Hepsi')
    expect(out).toContain('Atla')
  })

  it('0-4+ chip\'leri erişilebilir etiketle gelir', () => {
    const out = html(props(wk(['bench', [work()]])))
    expect(out).toContain('aria-label="Bench Press: 1 setin hepsine RIR 0 yaz"')
    expect(out).toContain('aria-label="Bench Press: 1 setin hepsine RIR 4+ yaz"')
    expect(out).toContain('aria-label="RIR girişini atla"')
  })

  it('eksik yoksa kart hiç görünmez, yalnız kapsama satırı kalır', () => {
    const out = html(props(wk(['bench', [warmup, work(2), work(0)]])))
    expect(out).not.toContain('RIR eksik')
    expect(out).not.toContain('Atla')
    expect(out).not.toContain('rir-card')
    expect(out).toContain("%100'inde RIR var")
  })

  it('tamamlanmış çalışma seti yoksa hiçbir şey çizmez', () => {
    expect(html(props(wk(['bench', [warmup]])))).toBe('')
    expect(html(props(wk()))).toBe('')
  })

  it('"Atla" sonrası kart gizlenir, kapsama satırı kalır', () => {
    const out = html(props(wk(['bench', [work(), work(1)]]), { skipped: true }))
    expect(out).not.toContain('RIR eksik')
    expect(out).not.toContain('Hepsi')
    expect(out).toContain("%50'inde RIR var")
  })

  it('"Hepsi" chip\'ine dokununca o egzersizin sırası ve değerle onApply çağrılır', () => {
    const onApply = vi.fn()
    const p = props(wk(['bench', [work()]], ['row', [work(), work()]]), { onApply })
    tapByLabel(RirSummary(p), 'Barbell Row: 2 setin hepsine RIR 3 yaz')
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(1, 3)
  })

  it('"Atla" yalnız onSkip çağırır, hiçbir RIR yazmaz', () => {
    const onApply = vi.fn()
    const onSkip = vi.fn()
    tapByLabel(RirSummary(props(wk(['bench', [work()]]), { onApply, onSkip })), 'RIR girişini atla')
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('çizim tek başına hiçbir şey yazmaz (otomatik doldurma yok)', () => {
    const onApply = vi.fn()
    const w = wk(['bench', [work()]])
    const snapshot = structuredClone(w)
    html(props(w, { onApply }))
    expect(onApply).not.toHaveBeenCalled()
    expect(w).toEqual(snapshot)
  })

  it('uygulandıktan sonra o satır kaybolur; son satır gidince kart da gider', () => {
    const w0 = wk(['bench', [work(), work()]], ['row', [work()]])
    const w1 = applyRirToEntry(w0, 0, 2)
    const out1 = html(props(w1))
    expect(out1).toContain('RIR eksik: 1 set')
    expect(out1).not.toContain('Bench Press')
    expect(out1).toContain("%67'inde RIR var")
    const out2 = html(props(applyRirToEntry(w1, 1, 1)))
    expect(out2).not.toContain('RIR eksik')
    expect(out2).toContain("%100'inde RIR var")
  })
})
