import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { ExerciseHistory } from '../components/ExerciseHistory.tsx'
import { MuscleFixEditor } from '../components/MuscleFixEditor.tsx'
import { imageUrl, nameLang, type Exercise } from '../lib/exercises.ts'
import { MUSCLES } from '../lib/muscles.ts'
import { useExercises } from '../lib/useExercises.ts'
import { EQUIPMENT_LABEL, equipmentLabel, muscleLabel } from '../lib/labels.ts'
import { useStore } from '../store/useStore.ts'

function Detail({ ex }: { ex: Exercise }) {
  const [editing, setEditing] = useState(false)
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
      <div className="eyebrow">Egzersiz</div>
      <div className="exname exdetail-name" lang={nameLang(ex)}>{ex.name}</div>
      <div className="sub">
        {ex.primaryMuscles.map(muscleLabel).join(', ')}
        {ex.secondaryMuscles.length > 0 && ` · yardımcı: ${ex.secondaryMuscles.map(muscleLabel).join(', ')}`}
        {ex.equipment ? ` · ${equipmentLabel(ex.equipment)}` : ''}
        {ex.original && ' · kaslar düzeltildi'}
      </div>
      <button className="btn small" onClick={() => setEditing(true)}>Kasları düzelt</button>
      <ExerciseHistory exId={ex.id} />
      {ex.images.length > 0 && (
        <div className="row" style={{ overflowX: 'auto' }}>
          {ex.images.map((p) => (
            <img key={p} className="exdetail-img" src={imageUrl(p)} alt={ex.name} loading="lazy" />
          ))}
        </div>
      )}
      {ex.instructions.length > 0 && (
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {ex.instructions.map((s, i) => (
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
      <input className="input" placeholder="Egzersiz adı" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className="input" aria-label="Ana kas" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
        <option value="">Ana kas (isteğe bağlı)</option>
        {MUSCLES.map((m) => (
          <option key={m} value={m}>{muscleLabel(m)}</option>
        ))}
      </select>
      <select className="input" aria-label="Ekipman" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
        <option value="">Ekipman (isteğe bağlı)</option>
        {Object.keys(EQUIPMENT_LABEL).map((q) => (
          <option key={q} value={q}>{equipmentLabel(q)}</option>
        ))}
      </select>
      <button className="btn primary block" disabled={!name.trim()}>Ekle</button>
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
          <div className="eyebrow">Kütüphane</div>
          <h1 className="display">Egzersizler</h1>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>+ Özel</button>
      </div>
      <ExerciseBrowser onSelect={(e) => setSelectedId(e.id)} />
      <BottomSheet open={!!selected} onClose={() => setSelectedId(null)}>
        {selected && <Detail key={selected.id} ex={selected} />}
      </BottomSheet>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="Özel egzersiz">
        <NewExercise onDone={() => setAdding(false)} />
      </BottomSheet>
    </div>
  )
}
