import { useMemo, useState } from 'react'
import { facetValues, filterExercises, imageUrl, type Exercise } from '../lib/exercises.ts'
import { equipmentLabel, muscleLabel } from '../lib/labels.ts'
import { useExercises } from '../lib/useExercises.ts'

interface Props {
  onSelect: (ex: Exercise) => void
  actionLabel?: string
}

const PAGE = 40

export function ExerciseBrowser({ onSelect, actionLabel }: Props) {
  const { list, loading, error } = useExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)

  const muscles = useMemo(() => facetValues(list, (e) => e.primaryMuscles), [list])
  const equipments = useMemo(() => facetValues(list, (e) => (e.equipment ? [e.equipment] : [])), [list])
  const filtered = useMemo(
    () => filterExercises(list, { query, muscle, equipment }),
    [list, query, muscle, equipment],
  )

  const reset = () => setShown(PAGE)

  if (error) return <p className="sub">Egzersizler yüklenemedi: {error}</p>

  return (
    <div className="stack exbrowser">
      <input
        className="input"
        type="search"
        placeholder="Egzersiz ara…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          reset()
        }}
      />
      <div className="eyebrow muted">Kas grubu</div>
      <div className="chips">
        <button className={`chip${muscle === null ? ' on' : ''}`} onClick={() => { setMuscle(null); reset() }}>Tüm kaslar</button>
        {muscles.map((m) => (
          <button key={m} className={`chip${muscle === m ? ' on' : ''}`} onClick={() => { setMuscle(m); reset() }}>{muscleLabel(m)}</button>
        ))}
      </div>
      <div className="eyebrow muted">Ekipman</div>
      <div className="chips">
        <button className={`chip${equipment === null ? ' on' : ''}`} onClick={() => { setEquipment(null); reset() }}>Tüm ekipman</button>
        {equipments.map((q) => (
          <button key={q} className={`chip${equipment === q ? ' on' : ''}`} onClick={() => { setEquipment(q); reset() }}>{equipmentLabel(q)}</button>
        ))}
      </div>

      <p className="sub resultcount">{loading ? 'Yükleniyor…' : `${filtered.length} egzersiz`}</p>

      <div className="card" style={{ padding: '4px 14px' }}>
        {filtered.slice(0, shown).map((e) => (
          <button key={e.id} className="exrow" onClick={() => onSelect(e)}>
            {e.images[0] ? (
              <img className="thumb" src={imageUrl(e.images[0])} alt="" loading="lazy" />
            ) : (
              <div className="thumb" />
            )}
            <div className="grow">
              <div className="exname">{e.name}</div>
              <div className="sub">
                {e.primaryMuscles.map(muscleLabel).join(', ')}
                {e.equipment ? ` · ${equipmentLabel(e.equipment)}` : ''}
              </div>
            </div>
            {actionLabel ? <span className="exaction">{actionLabel}</span> : <span className="chev" aria-hidden="true">›</span>}
          </button>
        ))}
        {!loading && filtered.length === 0 && <p className="sub">Sonuç yok.</p>}
      </div>

      {filtered.length > shown && (
        <button className="btn block" onClick={() => setShown((n) => n + PAGE)}>
          Daha fazla göster
        </button>
      )}
    </div>
  )
}
