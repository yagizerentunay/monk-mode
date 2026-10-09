import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDayTitle } from '../lib/calendar.ts'
import { formatSet } from '../lib/sets.ts'
import { formatLoad } from '../lib/load.ts'
import { formatWeight } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { zeroWeightFlags } from '../lib/zeroWeight.ts'
import { workoutVolume } from '../lib/workout.ts'
import type { Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { WorkoutEditor } from './WorkoutEditor.tsx'

interface Props {
  workout: Workout
  /** Antrenman silinince çağrılır (sheet'i kapatmak ya da listeye dönmek için). */
  onClose: () => void
  /** Tarih sheet başlığında zaten görünüyorsa (takvim) satırda tekrarlanmaz. */
  hideDate?: boolean
}

/** Kaydedilmiş bir antrenmanın özeti; tekrarlama, düzenleme ve silme. Geçmiş sheet'inde ve takvimde ortak. */
export function WorkoutDetail({ workout, onClose, hideDate }: Props) {
  const { byId } = useExercises()
  const unit = useStore((s) => s.settings.unit)
  const routines = useStore((s) => s.routines)
  const hasActive = useStore((s) => s.active !== null)
  const startWorkout = useStore((s) => s.startWorkout)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const updateWorkout = useStore((s) => s.updateWorkout)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const canRepeat = !hasActive && routines.some((r) => r.id === workout.routineId)

  if (editing) {
    return (
      <WorkoutEditor
        workout={workout}
        onCancel={() => setEditing(false)}
        onSave={(updated) => {
          updateWorkout(updated)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="stack">
      <div className="eyebrow muted">{hideDate ? '' : `${formatDayTitle(workout.d)} · `}{formatWeight(workoutVolume(workout), unit)} {unit} hacim</div>
      {workout.note && <div className="note">{workout.note}</div>}
      {workout.entries.map((e, i) => {
        const zero = zeroWeightFlags(e, byId.get(e.exId)?.equipment)
        return (
          <div key={i}>
            <div className="exname">{byId.get(e.exId)?.name ?? e.exId}</div>
            <div className="sub">
              {e.sets.length === 0
                ? 'Set yapılmadı'
                : e.sets
                    .map((s, si) => ({ s, si }))
                    .filter(({ s }) => !s.warmup)
                    .map(({ s, si }, i) => (
                      <span key={si}>
                        {i > 0 && ' · '}
                        {formatSet(s, formatLoad(e.bw, s.w, unit))}
                        {zero[si] && <span className="zeromark"> {formatWeight(0, unit)} {unit}?</span>}
                      </span>
                    ))}
            </div>
            {e.note && <div className="note">{e.note}</div>}
          </div>
        )
      })}
      <div className="row">
        {canRepeat && (
          <button
            className="btn primary grow"
            onClick={() => {
              startWorkout(workout.routineId!)
              navigate('/workout')
            }}
          >
            Rutini tekrarla
          </button>
        )}
        <button className="btn grow" onClick={() => setEditing(true)}>Düzenle</button>
        <button
          className="btn danger grow"
          onClick={() => {
            if (confirm('Bu antrenman geçmişten silinsin mi?')) {
              deleteWorkout(workout.id)
              onClose()
            }
          }}
        >
          Sil
        </button>
      </div>
    </div>
  )
}
