import { useState } from 'react'
import { getLang, t } from '../i18n/index.ts'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { ExerciseHistory } from '../components/ExerciseHistory.tsx'
import { MuscleFixEditor } from '../components/MuscleFixEditor.tsx'
import { instructionsFor, nameLang, thumbSource, type Exercise } from '../lib/exercises.ts'
import { MUSCLES } from '../lib/muscles.ts'
import { useExercises } from '../lib/useExercises.ts'
import { EQUIPMENT_LABEL, equipmentLabel, muscleLabel } from '../lib/labels.ts'
import { useStore } from '../store/useStore.ts'

function Detail({ ex }: { ex: Exercise }) {
  const [editing, setEditing] = useState(false)
  const instructions = instructionsFor(ex, getLang())
  if (editing) {
    return (
      <div className="stack">
        <div className="exname exdetail-name" lang={nameLang(ex)}>{ex.name}</div>
        <MuscleFixEditor ex={ex} onClose={() => setEditing(false)} />
      </div>
    )
  }
  return (
    <div className="stack">
      <div className="eyebrow">{t('stats.exerciseAria')}</div>
      <div className="exname exdetail-name" lang={nameLang(ex)}>{ex.name}</div>
      <div className="sub">
        {ex.primaryMuscles.map(muscleLabel).join(', ')}
        {ex.secondaryMuscles.length > 0 && ` · ${t('library.secondary', { list: ex.secondaryMuscles.map(muscleLabel).join(', ') })}`}
        {ex.equipment ? ` · ${equipmentLabel(ex.equipment)}` : ''}
        {ex.original && ` · ${t('library.fixed')}`}
      </div>
      <button className="btn small" onClick={() => setEditing(true)}>{t('fix.title')}</button>
      <ExerciseHistory exId={ex.id} />
      {ex.illustration ? (
        <img className="exdetail-img" src={ex.illustration} alt={ex.name} loading="lazy" />
      ) : (
        thumbSource(ex) && (
          <div className="stack">
            <img className="exdetail-img thumb-muscle" src={thumbSource(ex)!.url} alt="" loading="lazy" />
            <p className="sub">{t('library.noImage')}</p>
          </div>
        )
      )}
      {instructions.length > 0 && (
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {instructions.map((s, i) => (
            <li key={i} className="sub" style={{ marginBottom: 6 }}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

function NewExercise({ onDone }: { onDone: () => void }) {
  const add = useStore((s) => s.addCustomExercise)
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        add({
          name: name.trim(),
          primaryMuscles: muscle ? [muscle] : [],
          equipment,
        })
        onDone()
      }}
    >
      <input className="input" placeholder={t('library.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className="input" aria-label={t('library.mainMuscle')} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
        <option value="">{t('library.mainMuscleOptional')}</option>
        {MUSCLES.map((m) => (
          <option key={m} value={m}>{muscleLabel(m)}</option>
        ))}
      </select>
      <select className="input" aria-label={t('exercises.equipment')} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
        <option value="">{t('library.equipmentOptional')}</option>
        {Object.keys(EQUIPMENT_LABEL).map((q) => (
          <option key={q} value={q}>{equipmentLabel(q)}</option>
        ))}
      </select>
      <button className="btn primary block" disabled={!name.trim()}>{t('workout.add')}</button>
    </form>
  )
}

export function Library() {
  // Seçimi kimlikle tut: kas düzeltmesi listeyi yenileyince detay güncel kasları göstersin.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { byId } = useExercises()
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const [adding, setAdding] = useState(false)

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <div className="eyebrow">{t('library.eyebrow')}</div>
          <h1 className="display">{t('library.title')}</h1>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>+ {t('library.custom')}</button>
      </div>
      <ExerciseBrowser onSelect={(e) => setSelectedId(e.id)} />
      <BottomSheet open={!!selected} onClose={() => setSelectedId(null)}>
        {selected && <Detail key={selected.id} ex={selected} />}
      </BottomSheet>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title={t('library.customTitle')}>
        <NewExercise onDone={() => setAdding(false)} />
      </BottomSheet>
    </div>
  )
}
