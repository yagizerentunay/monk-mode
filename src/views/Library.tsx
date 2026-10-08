import { useState } from 'react'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { ExerciseHistory } from '../components/ExerciseHistory.tsx'
import { imageUrl, nameLang, type Exercise } from '../lib/exercises.ts'
import { useStore } from '../store/useStore.ts'

function Detail({ ex }: { ex: Exercise }) {
  return (
    <div className="stack">
      <div className="eyebrow">Egzersiz</div>
      <div className="exname exdetail-name" lang={nameLang(ex)}>{ex.name}</div>
      <div className="sub tag">
        {ex.primaryMuscles.join(', ')}
        {ex.secondaryMuscles.length > 0 && ` · yardımcı: ${ex.secondaryMuscles.join(', ')}`}
        {ex.equipment ? ` · ${ex.equipment}` : ''}
      </div>
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
          primaryMuscles: muscle.trim() ? [muscle.trim().toLowerCase()] : [],
          equipment: equipment.trim().toLowerCase(),
        })
        onDone()
      }}
    >
      <input className="input" placeholder="Egzersiz adı" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="input" placeholder="Ana kas (örn. chest)" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
      <input className="input" placeholder="Ekipman (örn. barbell)" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
      <button className="btn primary block" disabled={!name.trim()}>Ekle</button>
    </form>
  )
}

export function Library() {
  const [selected, setSelected] = useState<Exercise | null>(null)
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
      <ExerciseBrowser onSelect={setSelected} />
      <BottomSheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && <Detail ex={selected} />}
      </BottomSheet>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="Özel egzersiz">
        <NewExercise onDone={() => setAdding(false)} />
      </BottomSheet>
    </div>
  )
}
