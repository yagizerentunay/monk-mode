import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Exercise } from '../lib/exercises.ts'
import type { Suggestion } from '../lib/muscleSuggest.ts'
import { addToRoutineById, defaultExCfg } from '../lib/routineAdd.ts'
import { defaultState, type Routine } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { byLabel, click, findAll } from './elementTree.ts'
import { MuscleSuggestionList } from './MuscleSuggestions.tsx'

const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: `Ex ${id}`,
  level: 'beginner',
  equipment: 'barbell',
  category: 'strength',
  primaryMuscles: ['glutes'],
  secondaryMuscles: [],
  instructions: [],
  images: [],
  ...over,
})

const sug = (id: string, timesDone = 0, over: Partial<Exercise> = {}): Suggestion => ({ ex: ex(id, over), timesDone })

const routine = (id: string, name: string, exIds: string[] = []): Routine => ({
  id,
  name,
  ex: exIds.map((exId) => ({ exId, sets: 3, reps: 8, weight: 0, prog: 'double', inc: 2.5, repsMax: 12 })),
})

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

function props(over: Partial<Parameters<typeof MuscleSuggestionList>[0]> = {}) {
  return {
    muscle: 'glutes' as const,
    suggestions: [sug('a', 3), sug('b', 0, { equipment: 'cable' })],
    routines: [routine('r1', 'Bacak günü'), routine('r2', 'Full body', ['b'])],
    openId: null,
    notice: null,
    onToggle: () => {},
    onAdd: () => {},
    ...over,
  }
}

const html = (over: Parameters<typeof props>[0] = {}) => renderToStaticMarkup(<MuscleSuggestionList {...props(over)} />)

describe('MuscleSuggestionList', () => {
  it('kas adıyla başlık, egzersiz adı, ekipman ve geçmiş bilgisini gösterir', () => {
    const out = html()
    expect(out).toContain('Kalça için öneriler')
    expect(out).toContain('Ex a')
    expect(out).toContain('Barbell · 3 antrenmanda yaptın')
    expect(out).toContain('Kablo · Henüz yapmadın')
    expect(out).toContain('lang="en"')
  })

  it('her satırda erişilebilir adı olan "Rutine ekle" düğmesi vardır', () => {
    const out = html()
    expect((out.match(/>Rutine ekle</g) ?? []).length).toBe(2)
    expect(out).toContain('aria-label="Ex a egzersizini rutine ekle"')
    expect(out).toContain('aria-expanded="false"')
  })

  it('hiç rutin yoksa düğme yerine yönlendirme gösterir', () => {
    const out = html({ routines: [] })
    expect(out).not.toContain('Rutine ekle<')
    expect(out).toContain('Plan sekmesinde bir rutin oluştur')
    expect(out).toContain('Ex a')
  })

  it('öneri yoksa bilgi notu verir, yönlendirme göstermez', () => {
    const out = html({ suggestions: [], routines: [] })
    expect(out).toContain('önerilecek bir egzersiz bulunamadı')
    expect(out).not.toContain('Plan sekmesinde')
  })

  it('yüklenirken bekleme metni gösterir', () => {
    expect(html({ loading: true })).toContain('Egzersizler yükleniyor')
  })

  it('rutin seçicisi açıkken rutinleri listeler; egzersizin zaten olduğu rutin "Zaten ekli" görünür', () => {
    const out = html({ openId: 'b' })
    expect(out).toContain('aria-expanded="true"')
    expect(out).toContain('aria-label="Ex b egzersizini Bacak günü rutinine ekle"')
    expect(out).toContain('Full body · Zaten ekli')
    expect(out).not.toContain('aria-label="Ex b egzersizini Full body rutinine ekle"')
  })

  it('seçici yalnız açık satırda görünür', () => {
    const out = html({ openId: 'a' })
    expect(out).toContain('Ex a için rutin seç')
    expect(out).not.toContain('Ex b için rutin seç')
  })

  it('ekleme bildirimi ekran okuyucuya status olarak duyurulur', () => {
    const out = html({ notice: 'Ex a, "Bacak günü" rutinine eklendi.' })
    expect(out).toContain('role="status"')
    expect(out).toContain('rutinine eklendi.')
  })

  it('düğmeye dokunmak seçiciyi açma işleyicisini, rutin düğmesi ekleme işleyicisini çağırır', () => {
    const toggled: string[] = []
    const added: Array<[string, string]> = []
    const closed = props({ onToggle: (id) => toggled.push(id), onAdd: (r, e) => added.push([r, e.id]) })
    click(byLabel(MuscleSuggestionList(closed), 'Ex a egzersizini rutine ekle'))
    expect(toggled).toEqual(['a'])
    const open = MuscleSuggestionList({ ...closed, openId: 'a' })
    click(byLabel(open, 'Ex a egzersizini Full body rutinine ekle'))
    expect(added).toEqual([['r2', 'a']])
  })
})

describe('rutine ekleme akışı (depo ile)', () => {
  /** Bileşenin kullandığı ekleme yolu: addToRoutineById → saveRoutine. */
  function addVia(routineId: string, e: Exercise) {
    const next = addToRoutineById(useStore.getState().routines, routineId, e)
    if (next) useStore.getState().saveRoutine(next)
    return next
  }

  it('seçilen rutine varsayılan ayarlarla eklenir, diğer rutinler ve sıra değişmez', () => {
    useStore.getState().saveRoutine(routine('r1', 'Bacak günü', ['x']))
    useStore.getState().saveRoutine(routine('r2', 'Üst vücut', ['y']))
    const before = structuredClone(useStore.getState().routines)
    const e = ex('a', { name: 'Hip Thrust' })
    expect(addVia('r1', e)).not.toBeNull()
    const routines = useStore.getState().routines
    expect(routines.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(routines[0].ex.map((c) => c.exId)).toEqual(['x', 'a'])
    expect(routines[0].ex[1]).toEqual(defaultExCfg(e))
    expect(routines[1]).toEqual(before[1])
  })

  it('aynı egzersizi ikinci kez eklemez', () => {
    useStore.getState().saveRoutine(routine('r1', 'Bacak günü'))
    expect(addVia('r1', ex('a'))).not.toBeNull()
    expect(addVia('r1', ex('a'))).toBeNull()
    expect(useStore.getState().routines[0].ex).toHaveLength(1)
  })

  it('olmayan rutin kimliği hiçbir şey eklemez', () => {
    useStore.getState().saveRoutine(routine('r1', 'Bacak günü'))
    expect(addVia('yok', ex('a'))).toBeNull()
    expect(useStore.getState().routines[0].ex).toHaveLength(0)
  })

  it('saveRoutine kullanıldığı için eklenen egzersiz sonraki gösterimde "Zaten ekli" olur', () => {
    useStore.getState().saveRoutine(routine('r1', 'Bacak günü'))
    addVia('r1', ex('a'))
    const tree = MuscleSuggestionList(props({ routines: useStore.getState().routines, suggestions: [sug('a')], openId: 'a' }))
    expect(findAll(tree, (e) => e.props.className === 'tgt-had')).toHaveLength(1)
  })
})
