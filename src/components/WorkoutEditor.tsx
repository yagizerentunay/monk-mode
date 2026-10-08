import { useState } from 'react'
import { addSetTo, editSet, finalizeEdit, removeEntryAt, removeSetAt, setEntryNoteIn, setWorkoutNoteIn } from '../lib/editWorkout.ts'
import { describeSets } from '../lib/intensity.ts'
import { NOTE_MAX } from '../lib/notes.ts'
import { kgToUnit, unitToKg } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import type { Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { NumberField } from './NumberField.tsx'

interface Props {
  workout: Workout
  onSave: (updated: Workout) => void
  onCancel: () => void
}

/**
 * Kaydedilmiş antrenmanı düzeltme ekranı: ağırlık, tekrar (tek taraflıda sol/sağ), set ekle/sil,
 * egzersiz sil ve notlar. Değişiklikler bir taslakta tutulur, "Kaydet" ile yazılır.
 */
export function WorkoutEditor({ workout, onSave, onCancel }: Props) {
  const unit = useStore((s) => s.settings.unit)
  const { byId } = useExercises()
  const [draft, setDraft] = useState<Workout>(workout)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    const out = finalizeEdit(draft)
    if (!out) {
      setError('Hiç çalışma seti kalmadı. Antrenmanı silmek için Vazgeç\'e basıp "Sil"i kullan.')
      return
    }
    onSave(out)
  }

  return (
    <div className="stack">
      <label className="field">
        <span className="sub">Antrenman notu</span>
        <textarea
          className="input"
          rows={2}
          maxLength={NOTE_MAX}
          value={draft.note ?? ''}
          onChange={(e) => setDraft((d) => setWorkoutNoteIn(d, e.target.value))}
        />
      </label>

      {draft.entries.map((entry, ei) => {
        const name = byId.get(entry.exId)?.name ?? entry.exId
        const meta = describeSets(entry.sets)
        return (
          <div key={ei} className="stack editentry">
            <div className="row between">
              <div className="exname grow">{name}</div>
              <button
                className="btn small danger"
                aria-label={`${name} egzersizini sil`}
                onClick={() => {
                  if (confirm(`"${name}" bu antrenmandan çıkarılsın mı?`)) setDraft((d) => removeEntryAt(d, ei))
                }}
              >
                ✕
              </button>
            </div>

            {entry.sets.map((set, si) => (
              <div key={si} className="setrow">
                <span className="setno">{meta[si].badge}</span>
                <NumberField
                  className="grow"
                  label={`${name} ${meta[si].name} ağırlık`}
                  value={set.w}
                  toDisplay={(v) => kgToUnit(v, unit)}
                  fromDisplay={(v) => unitToKg(v, unit)}
                  step={0.5}
                  onChange={(v) => setDraft((d) => editSet(d, ei, si, { w: v }))}
                />
                <span className="sub">{unit}</span>
                {set.sides ? (
                  <>
                    <NumberField
                      className="grow"
                      label={`${name} ${meta[si].name} sol tekrar`}
                      value={set.sides.L.r}
                      onChange={(v) => setDraft((d) => editSet(d, ei, si, { L: v }))}
                    />
                    <span className="sub">L</span>
                    <NumberField
                      className="grow"
                      label={`${name} ${meta[si].name} sağ tekrar`}
                      value={set.sides.R.r}
                      onChange={(v) => setDraft((d) => editSet(d, ei, si, { R: v }))}
                    />
                    <span className="sub">R</span>
                  </>
                ) : (
                  <>
                    <NumberField
                      className="grow"
                      label={`${name} ${meta[si].name} tekrar`}
                      value={set.r}
                      onChange={(v) => setDraft((d) => editSet(d, ei, si, { r: v }))}
                    />
                    <span className="sub">tkr</span>
                  </>
                )}
                <button
                  className="btn small"
                  aria-label={`${name} ${meta[si].name} sil`}
                  onClick={() => setDraft((d) => removeSetAt(d, ei, si))}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="row wrap">
              <button className="btn small" onClick={() => setDraft((d) => addSetTo(d, ei))}>+ Set</button>
            </div>
            <input
              className="input"
              aria-label={`${name} notu`}
              placeholder="Not"
              maxLength={NOTE_MAX}
              value={entry.note ?? ''}
              onChange={(e) => setDraft((d) => setEntryNoteIn(d, ei, e.target.value))}
            />
          </div>
        )
      })}

      {error && <p className="warntext" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary grow" onClick={save}>Kaydet</button>
        <button className="btn grow" onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  )
}
