import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyMuscleSets, MUSCLES, weekRanges, type MuscleId, type MuscleSets, type MuscleTargets } from '../lib/muscles.ts'
import { MuscleWeekList, UNDER_TARGET_LIMIT } from './MuscleWeekList.tsx'
import { byLabel, byText, click } from './elementTree.ts'

function makeCmp(thisWeek: Partial<MuscleSets>, lastWeek: Partial<MuscleSets> = {}) {
  const t = { ...emptyMuscleSets(), ...thisWeek }
  const l = { ...emptyMuscleSets(), ...lastWeek }
  const delta = emptyMuscleSets()
  for (const m of MUSCLES) delta[m] = t[m] - l[m]
  return { ranges: weekRanges(new Date(2026, 9, 8), 1), thisWeek: t, lastWeek: l, delta }
}

interface Over {
  targets?: MuscleTargets
  selected?: MuscleId | null
  showAll?: boolean
  onSelect?: (m: MuscleId) => void
  onToggleAll?: () => void
}

function props(cmp: ReturnType<typeof makeCmp>, o: Over = {}) {
  return {
    cmp,
    targets: o.targets,
    selected: o.selected ?? null,
    onSelect: o.onSelect ?? (() => {}),
    showAll: o.showAll ?? false,
    onToggleAll: o.onToggleAll ?? (() => {}),
  }
}

const html = (cmp: ReturnType<typeof makeCmp>, o: Over = {}) => renderToStaticMarkup(<MuscleWeekList {...props(cmp, o)} />)

describe('MuscleWeekList', () => {
  it('çalışılmamış kaslar da bar ve 0/10 ile listelenir; hedefin altındakiler işaretlidir', () => {
    const out = html(makeCmp({ chest: 12, glutes: 0 }))
    expect(out).toContain('aria-pressed="false"')
    // Kalça: hiç çalışılmamış ama satır var, 0/10 ve işaretli.
    const glutes = out.match(/<button[^>]*class="musclerow tgt-below"[^>]*>(?:(?!<\/button>).)*Kalça<span class="sr-only">/)
    expect(glutes).not.toBeNull()
    expect(out).toContain('<small>/10</small>')
    expect((out.match(/class="musclerow/g) ?? []).length).toBe(MUSCLES.length)
    // Göğüs hedefte: işaretsiz.
    expect(out).toContain('class="musclerow"')
  })

  it('"eksik" değil "ilerleme" olarak çerçevelenir', () => {
    const out = html(makeCmp({ chest: 3 }))
    expect(out).toContain('Hafta devam ediyor (gün 4/7)')
    expect(out).toContain('Hafta bitmedi; bunlar ilerleme göstergesidir, eksik değil.')
    expect(out).toContain('hedefe doğru, hafta sürüyor')
    expect(out).not.toMatch(/eksik kas|yetersiz/i)
  })

  it('hiç set yokken bilgi notu ve 0/hedef satırları birlikte görünür', () => {
    const out = html(makeCmp({}))
    expect(out).toContain('Bu hafta ve geçen hafta tamamlanmış set yok')
    expect(out).toContain('<small>/10</small>')
  })

  it('hedefi 0 olan çalışılmış kas "hedef yok" gösterir ve özette geçmez; çalışılmamışsa listeden çıkar', () => {
    const out = html(makeCmp({ neck: 3 }), { targets: { neck: 0, traps: 0 } })
    expect(out).toContain('hedef yok')
    expect(out).not.toContain('aria-label="Boyun')
    expect(out).toContain('Hedefi olmayan ve çalışılmayan: Trapez')
    expect((out.match(/class="musclerow/g) ?? []).length).toBe(MUSCLES.length - 1)
  })

  it('tüm hedefler 0 ve set yoksa liste boştur', () => {
    const zero = Object.fromEntries(MUSCLES.map((m) => [m, 0]))
    const out = html(makeCmp({}), { targets: zero })
    expect(out).not.toContain('musclerow')
    expect(out).not.toContain('underweek')
  })

  it('kas başına hedef 0/6 gibi görünür ve hedefe ulaşan satır işaretsizdir', () => {
    const out = html(makeCmp({ chest: 6 }), { targets: { chest: 6 } })
    expect(out).toContain('<small>/6</small>')
    expect(out).not.toContain('musclerow tgt-below"><span class="mrname">Göğüs')
  })

  it('özet varsayılan olarak 3 kas sayar; "Tümünü gör" kalanın sayısını yazar ve genişletir', () => {
    const cmp = makeCmp({})
    const short = html(cmp)
    expect((short.match(/class="tgt-chip"/g) ?? []).length).toBe(UNDER_TARGET_LIMIT)
    expect(short).toContain(`Tümünü gör (${MUSCLES.length})`)
    expect(short).toContain('aria-expanded="false"')
    const full = html(cmp, { showAll: true })
    expect((full.match(/class="tgt-chip"/g) ?? []).length).toBe(MUSCLES.length)
    expect(full).toContain('Daha az göster')
    expect(full).toContain('aria-expanded="true"')
  })

  it('3 veya daha az kas hedefin altındaysa "Tümünü gör" yoktur', () => {
    const zero = Object.fromEntries(MUSCLES.map((m) => [m, 0]))
    const out = html(makeCmp({}), { targets: { ...zero, chest: 10, lats: 10 } })
    expect((out.match(/class="tgt-chip"/g) ?? []).length).toBe(2)
    expect(out).not.toContain('Tümünü gör')
  })

  it('özet hedefe en uzak kastan başlar', () => {
    const out = html(makeCmp({ abdominals: 9, abductors: 8, adductors: 7, biceps: 1 }))
    const first = out.match(/class="tgt-chip"[^>]*>([^<]*)</g) ?? []
    // Gap sırası: 10 açığı olanlar önce, biceps (9) sonra. Eşitlikte büyük kas grupları öne gelir
    // (MUSCLE_PRIORITY): boyun/ön kol gibi küçük kaslar değil, kalça ve arka bacak.
    expect(first.length).toBe(UNDER_TARGET_LIMIT)
    expect(first[0]).toContain('Kalça 0/10')
    expect(first[1]).toContain('Arka bacak')
    expect(first[2]).toContain('Ön bacak')
  })

  it('satıra, özet çipine ve "Tümünü gör"e dokunmak işleyicileri çağırır', () => {
    const picked: MuscleId[] = []
    let toggled = 0
    const cmp = makeCmp({})
    const tree = MuscleWeekList(
      props(cmp, { onSelect: (m) => picked.push(m), onToggleAll: () => toggled++ }),
    )
    click(byLabel(tree, 'Kalça 0/10 set'))
    expect(picked).toEqual(['glutes'])
    click(byText(tree, `Tümünü gör (${MUSCLES.length})`))
    expect(toggled).toBe(1)
  })
})
