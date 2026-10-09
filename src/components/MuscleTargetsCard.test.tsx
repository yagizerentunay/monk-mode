import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { MUSCLES, type MuscleTargets } from '../lib/muscles.ts'
import { defaultState } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { MuscleTargetsCard, MuscleTargetsEditor } from './MuscleTargetsCard.tsx'
import { byLabel, byText, click, textOf } from './elementTree.ts'

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

/** Editörü depoya bağlar: tıklama → ayar yazılır → depodan yeniden çizilir (Ayarlar'daki kartla aynı akış). */
function mount() {
  const draw = () =>
    MuscleTargetsEditor({
      targets: useStore.getState().settings.muscleTargets,
      onChange: (muscleTargets) => useStore.getState().setSettings({ muscleTargets }),
    })
  return {
    tree: draw,
    press: (label: string) => click(byLabel(draw(), label)),
    pressText: (text: string) => click(byText(draw(), text)),
  }
}

const value = (tree: ReturnType<typeof MuscleTargetsEditor>, label: string) => textOf(byLabel(tree, label))

describe('MuscleTargetsCard', () => {
  // Not: zustand sunucu çiziminde her zaman başlangıç durumunu okur; bu yüzden kayıtlı değerler
  // aşağıda `targets` verilerek çizilir, depo akışı ise işleyiciler üzerinden test edilir.
  it('kartı çizer: 17 kasın hedefi varsayılan 10 ve "kesin hedef değil" notu', () => {
    const html = renderToStaticMarkup(<MuscleTargetsCard />)
    expect(html).toContain('Haftalık kas hedefleri')
    expect(html).toContain('Kesin bilimsel bir hedef değil')
    expect((html.match(/<output/g) ?? []).length).toBe(MUSCLES.length)
    expect(html).toContain('aria-label="Kalça haftalık hedef (set)">10<')
    expect(html).not.toContain('hedef yok')
  })

  it('kayıtlı hedefleri gösterir; 0 olan kasta "hedef yok" yazar', () => {
    const html = renderToStaticMarkup(
      <MuscleTargetsEditor targets={{ glutes: 14, abdominals: 0 }} onChange={() => {}} />,
    )
    expect(html).toContain('aria-label="Kalça haftalık hedef (set)">14<')
    expect(html).toContain('aria-label="Karın haftalık hedef (set)">0<')
    expect(html).toContain('hedef yok')
  })

  it('+ ve − tek set kaydırır ve hedefi ayarlara yazar', () => {
    const m = mount()
    m.press('Kalça hedefini artır')
    m.press('Kalça hedefini artır')
    expect(useStore.getState().settings.muscleTargets).toEqual({ glutes: 12 })
    expect(value(m.tree(), 'Kalça haftalık hedef (set)')).toBe('12')
    m.press('Kalça hedefini azalt')
    expect(useStore.getState().settings.muscleTargets).toEqual({ glutes: 11 })
  })

  it('varsayılana geri dönen kasın özel hedefi kalkar; hiç özel hedef kalmazsa ayar silinir', () => {
    const m = mount()
    m.press('Biseps hedefini artır')
    expect(useStore.getState().settings.muscleTargets).toEqual({ biceps: 11 })
    m.press('Biseps hedefini azalt')
    expect(useStore.getState().settings.muscleTargets).toBeUndefined()
  })

  it('0 alt sınırdır: azalt düğmesi kapanır ve tıklama bir şey yapmaz; 0 saklanır', () => {
    useStore.getState().setSettings({ muscleTargets: { neck: 1 } })
    const m = mount()
    m.press('Boyun hedefini azalt')
    expect(useStore.getState().settings.muscleTargets).toEqual({ neck: 0 })
    expect(byLabel(m.tree(), 'Boyun hedefini azalt').props.disabled).toBe(true)
    m.press('Boyun hedefini azalt')
    expect(useStore.getState().settings.muscleTargets).toEqual({ neck: 0 })
    expect(textOf(m.tree())).toContain('hedef yok')
  })

  it('40 üst sınırdır', () => {
    useStore.getState().setSettings({ muscleTargets: { lats: 40 } })
    const m = mount()
    expect(byLabel(m.tree(), 'Sırt (lat) hedefini artır').props.disabled).toBe(true)
    m.press('Sırt (lat) hedefini artır')
    expect(useStore.getState().settings.muscleTargets).toEqual({ lats: 40 })
  })

  it('"Varsayılana dön" tüm özel hedefleri siler; özel hedef yokken kapalıdır', () => {
    const m = mount()
    expect(byText(m.tree(), 'Varsayılana dön').props.disabled).toBe(true)
    useStore.getState().setSettings({ muscleTargets: { glutes: 14, abdominals: 0, chest: 20 } })
    expect(byText(m.tree(), 'Varsayılana dön').props.disabled).toBe(false)
    m.pressText('Varsayılana dön')
    expect(useStore.getState().settings.muscleTargets).toBeUndefined()
    expect(value(m.tree(), 'Kalça haftalık hedef (set)')).toBe('10')
  })

  it('düzenleme diğer ayarlara ve girdi nesnesine dokunmaz', () => {
    useStore.getState().setSettings({ restSec: 120, muscleTargets: { chest: 12 } })
    const before: MuscleTargets = useStore.getState().settings.muscleTargets!
    mount().press('Göğüs hedefini artır')
    expect(before).toEqual({ chest: 12 })
    expect(useStore.getState().settings.restSec).toBe(120)
    expect(useStore.getState().settings.muscleTargets).toEqual({ chest: 13 })
  })

  it('düğmelerin Türkçe erişilebilir adı vardır', () => {
    const tree = MuscleTargetsEditor({ targets: undefined, onChange: () => {} })
    for (const m of ['Karın', 'Ön bacak']) {
      expect(byLabel(tree, `${m} hedefini azalt`).type).toBe('button')
      expect(byLabel(tree, `${m} hedefini artır`).type).toBe('button')
    }
  })
})
