import { t } from '../i18n/index.ts'
import { useState } from 'react'
import {
  addSetTo,
  editSet,
  finalizeEdit,
  moveEntryAt,
  removeEntryAt,
  removeSetAt,
  setEntryBwKgIn,
  setEntryNoteIn,
  setWorkoutNoteIn,
} from '../lib/editWorkout.ts'
import { kmToMeters, metersToKm, setMeters } from '../lib/distance.ts'
import { describeSets } from '../lib/intensity.ts'
import { NOTE_MAX } from '../lib/notes.ts'
import { kgToUnit, unitToKg } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { zeroWeightFlags } from '../lib/zeroWeight.ts'
import type { Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { DurationField } from './DurationField.tsx'
import { NumberField } from './NumberField.tsx'

interface Props {
  workout: Workout
  onSave: (updated: Workout) => void
  onCancel: () => void
}

/**
 * Kaydedilmiş antrenmanı düzeltme ekranı: ağırlık, tekrar (tek taraflıda sol/sağ), set ekle/sil,
 * egzersiz sil/sırala ve notlar. Değişiklikler bir taslakta tutulur, "Kaydet" ile yazılır.
 */
export function WorkoutEditor({ workout, onSave, onCancel }: Props) {
  const unit = useStore((s) => s.settings.unit)
  const { byId } = useExercises()
  const [draft, setDraft] = useState<Workout>(workout)
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    const out = finalizeEdit(draft)
    if (!out) {
      setError(t('editor.noSets'))
      return
    }
    onSave(out)
  }

  return (
    <div className="stack workouteditor">
      <div className="eyebrow">{t('editor.title')}</div>
      <label className="field">
        <span className="sub">{t('editor.workoutNote')}</span>
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
        const zero = zeroWeightFlags(entry, byId.get(entry.exId)?.equipment)
        return (
          <div key={ei} className="stack editentry">
            <div className="row between">
              <div className="exname grow">{name}</div>
              <button
                className="btn small"
                aria-label={t('workout.moveUpAria', { name })}
                disabled={ei === 0}
                onClick={() => setDraft((d) => moveEntryAt(d, ei, -1))}
              >
                ↑
              </button>
              <button
                className="btn small"
                aria-label={t('workout.moveDownAria', { name })}
                disabled={ei === draft.entries.length - 1}
                onClick={() => setDraft((d) => moveEntryAt(d, ei, 1))}
              >
                ↓
              </button>
              <button
                className="btn small danger"
                aria-label={t('editor.removeExerciseAria', { name })}
                onClick={() => {
                  if (confirm(t('editor.removeExerciseConfirm', { name }))) setDraft((d) => removeEntryAt(d, ei))
                }}
              >
                ✕
              </button>
            </div>

            {entry.bw && (
              <div className="row between editbw">
                <span className="sub">{t('editor.bodyweight', { unit })}{entry.bwKg === undefined ? ` · ${t('editor.noRecord')}` : ''}</span>
                <NumberField
                  label={t('editor.bodyweightAria', { name })}
                  value={entry.bwKg ?? 0}
                  toDisplay={(v) => kgToUnit(v, unit)}
                  fromDisplay={(v) => unitToKg(v, unit)}
                  step={0.5}
                  onChange={(v) => setDraft((d) => setEntryBwKgIn(d, ei, v))}
                />
              </div>
            )}

            {entry.distance && entry.sets.map((set, si) => (
              <div key={si} className="setrow">
                <span className="setno">{meta[si].badge}</span>
                <NumberField
                  className="grow"
                  label={`${name} ${meta[si].name} ${t('set.distance')}`}
                  value={setMeters(set)}
                  toDisplay={metersToKm}
                  fromDisplay={kmToMeters}
                  step={0.1}
                  onChange={(v) => setDraft((d) => editSet(d, ei, si, { m: v }))}
                />
                <span className="sub">km</span>
                <DurationField
                  className="grow"
                  long
                  label={`${name} ${meta[si].name} ${t('set.time')}`}
                  value={set.r}
                  onChange={(v) => setDraft((d) => editSet(d, ei, si, { r: v }))}
                />
                <button
                  className="btn small"
                  aria-label={t('set.deleteAria', { name: `${name} ${meta[si].name}` })}
                  onClick={() => setDraft((d) => removeSetAt(d, ei, si))}
                >
                  ✕
                </button>
              </div>
            ))}

            {!entry.distance && entry.sets.map((set, si) => (
              <div key={si} className="setrow">
                <span className="setno">{meta[si].badge}</span>
                <NumberField
                  className={`grow${zero[si] ? ' warnfield' : ''}`}
                  label={`${name} ${meta[si].name} ${entry.bw ? t('set.addedLoad') : t('set.weight')}`}
                  value={set.w}
                  min={entry.bw ? -300 : undefined}
                  toDisplay={(v) => kgToUnit(v, unit)}
                  fromDisplay={(v) => unitToKg(v, unit)}
                  step={0.5}
                  onChange={(v) => setDraft((d) => editSet(d, ei, si, { w: v }))}
                />
                <span className="sub">{unit}</span>
                {set.sides ? (
                  <>
                    {entry.timed ? (
                      <DurationField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('editor.left')} ${t('set.time')}`}
                        value={set.sides.L.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { L: v }))}
                      />
                    ) : (
                      <NumberField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('editor.left')} ${t('set.reps')}`}
                        value={set.sides.L.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { L: v }))}
                      />
                    )}
                    <span className="sub">L</span>
                    {entry.timed ? (
                      <DurationField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('editor.right')} ${t('set.time')}`}
                        value={set.sides.R.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { R: v }))}
                      />
                    ) : (
                      <NumberField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('editor.right')} ${t('set.reps')}`}
                        value={set.sides.R.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { R: v }))}
                      />
                    )}
                    <span className="sub">R</span>
                  </>
                ) : (
                  <>
                    {entry.timed ? (
                      <DurationField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('set.time')}`}
                        value={set.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { r: v }))}
                      />
                    ) : (
                      <NumberField
                        className="grow"
                        label={`${name} ${meta[si].name} ${t('set.reps')}`}
                        value={set.r}
                        onChange={(v) => setDraft((d) => editSet(d, ei, si, { r: v }))}
                      />
                    )}
                    <span className="sub">{entry.timed ? t('unit.sec') : t('editor.repsShort')}</span>
                  </>
                )}
                <button
                  className="btn small"
                  aria-label={t('set.deleteAria', { name: `${name} ${meta[si].name}` })}
                  onClick={() => setDraft((d) => removeSetAt(d, ei, si))}
                >
                  ✕
                </button>
                {zero[si] && <div className="zerowarn" role="note">{t('set.zeroWarn')}</div>}
              </div>
            ))}

            <div className="row wrap">
              <button className="btn small" onClick={() => setDraft((d) => addSetTo(d, ei))}>+ Set</button>
            </div>
            <input
              className="input"
              aria-label={t('workout.noteAria', { name })}
              placeholder={t('workout.note')}
              maxLength={NOTE_MAX}
              value={entry.note ?? ''}
              onChange={(e) => setDraft((d) => setEntryNoteIn(d, ei, e.target.value))}
            />
          </div>
        )
      })}

      {error && <p className="warntext" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div className="row">
        <button className="btn primary grow" onClick={save}>{t('common.save')}</button>
        <button className="btn grow" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
