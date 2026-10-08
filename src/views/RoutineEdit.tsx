import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { isUnilateralName } from '../lib/exercises.ts'
import { MAX_DROPS, MAX_WARMUPS } from '../lib/intensity.ts'
import { groupLetter, moveExercise, removeExercise, supersetInfo } from '../lib/superset.ts'
import { useExercises } from '../lib/useExercises.ts'
import { kgToUnit, unitToKg, type Unit } from '../lib/units.ts'
import { newId } from '../lib/workout.ts'
import type { ExCfg, ProgressionMode, Routine } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

const PROG_LABEL: Record<ProgressionMode, string> = {
  off: 'Kapalı',
  linear: 'Doğrusal (tüm tekrarlar tamam → +ağırlık)',
  double: 'Çift ilerleme (önce tekrar, sonra ağırlık)',
}

const PROG_SHORT: Record<ProgressionMode, string> = {
  off: 'İlerleme kapalı',
  linear: 'Doğrusal',
  double: 'Çift ilerleme',
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Varsayılandan (yeni eklenen egzersiz: çift ilerleme, ısınma/drop/süperset yok) farklı bir gelişmiş ayar var mı? */
function isCustom(cfg: ExCfg, i: number): boolean {
  return (cfg.warmups ?? 0) > 0 || (cfg.drops ?? 0) > 0 || (i > 0 && !!cfg.superset) || cfg.prog !== 'double'
}

/** Kapalı bölümde görünen tek satırlık özet: hiçbir ayar gizlenip kaybolmaz. */
function advSummary(cfg: ExCfg, unit: Unit): string {
  const parts: string[] = [PROG_SHORT[cfg.prog]]
  if (cfg.prog !== 'off') parts.push(`+${round2(kgToUnit(cfg.inc, unit))} ${unit}`)
  if ((cfg.warmups ?? 0) > 0) parts.push(`${cfg.warmups} ısınma`)
  if ((cfg.drops ?? 0) > 0) parts.push(`${cfg.drops} drop`)
  if (cfg.superset) parts.push('süperset')
  return parts.join(' · ')
}

function blankRoutine(): Routine {
  return { id: newId(), name: '', ex: [] }
}

export function RoutineEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const routines = useStore((s) => s.routines)
  const unit = useStore((s) => s.settings.unit)
  const saveRoutine = useStore((s) => s.saveRoutine)
  const deleteRoutine = useStore((s) => s.deleteRoutine)
  const { byId } = useExercises()

  const existing = useMemo(() => routines.find((r) => r.id === id), [routines, id])
  const [draft, setDraft] = useState<Routine>(() => existing ?? blankRoutine())
  const [picking, setPicking] = useState(false)

  const patchEx = (i: number, patch: Partial<ExCfg>) =>
    setDraft((d) => ({ ...d, ex: d.ex.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))

  const move = (i: number, dir: -1 | 1) => setDraft((d) => ({ ...d, ex: moveExercise(d.ex, i, dir) }))
  const groups = supersetInfo(draft.ex.map((e) => e.superset))

  const canSave = draft.name.trim() !== '' && draft.ex.length > 0

  return (
    <div className="stack">
      <div className="row between">
        <button className="btn small" onClick={() => navigate('/plan')}>← Planlar</button>
        <button
          className="btn primary small"
          disabled={!canSave}
          onClick={() => {
            saveRoutine({ ...draft, name: draft.name.trim() })
            navigate('/plan')
          }}
        >
          Kaydet
        </button>
      </div>

      <div>
        <div className="eyebrow">{existing ? 'Rutini düzenle' : 'Yeni rutin'}</div>
        <div className="sub">{draft.ex.length} egzersiz</div>
      </div>
      <input
        className="input routinename"
        aria-label="Rutin adı"
        placeholder="Rutin adı (örn. Push A)"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />

      {draft.ex.map((cfg, i) => (
        <div key={i} className={`card stack exedit${groups[i] ? ' ss' : ''}`}>
          <div className="row between">
            <div className="grow">
              <div className="eyebrow muted">Egzersiz {String(i + 1).padStart(2, '0')}</div>
              {groups[i] && <span className="badge on">Süperset {groupLetter(groups[i].group)}{groups[i].pos + 1}</span>}
              <div className="exname">{byId.get(cfg.exId)?.name ?? cfg.exId}</div>
            </div>
            <button className="btn small" aria-label="Yukarı" onClick={() => move(i, -1)}>↑</button>
            <button className="btn small" aria-label="Aşağı" onClick={() => move(i, 1)}>↓</button>
            <button
              className="btn small danger"
              aria-label="Kaldır"
              onClick={() => setDraft((d) => ({ ...d, ex: removeExercise(d.ex, i) }))}
            >
              ✕
            </button>
          </div>

          <div className="grid3">
            <label className="field">
              <span className="sub">Set</span>
              <NumberField value={cfg.sets} min={1} onChange={(v) => patchEx(i, { sets: Math.max(1, Math.round(v)) })} />
            </label>
            <label className="field">
              <span className="sub">Tekrar</span>
              <NumberField value={cfg.reps} min={1} onChange={(v) => patchEx(i, { reps: Math.max(1, Math.round(v)) })} />
            </label>
            <label className="field">
              <span className="sub">Ağırlık ({unit})</span>
              <NumberField
                value={cfg.weight}
                toDisplay={(v) => kgToUnit(v, unit)}
                fromDisplay={(v) => unitToKg(v, unit)}
                step={0.5}
                onChange={(v) => patchEx(i, { weight: v })}
              />
            </label>
          </div>

          <label className="row">
            <input
              type="checkbox"
              checked={!!cfg.side}
              onChange={(e) => patchEx(i, { side: e.target.checked })}
            />
            <span>Tek taraflı <span className="sub">(sol/sağ ayrı, ağırlık taraf başına)</span></span>
          </label>

          <details
            key={`adv-${cfg.exId}-${i}`}
            className="adv"
            open={isCustom(cfg, i)}
          >
            <summary>
              <span>Gelişmiş ayarlar</span>
              <span className="advsum">{advSummary(cfg, unit)}</span>
            </summary>
            <div className="stack advbody">
              {i > 0 && (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={!!cfg.superset}
                    onChange={(e) => patchEx(i, { superset: e.target.checked })}
                  />
                  <span>Öncekiyle süperset <span className="sub">(dönüşümlü, tur sonunda dinlenme)</span></span>
                </label>
              )}

              <div className="grid3">
                <label className="field">
                  <span className="sub">Isınma seti</span>
                  <NumberField
                    value={cfg.warmups ?? 0}
                    onChange={(v) => patchEx(i, { warmups: Math.min(MAX_WARMUPS, Math.max(0, Math.round(v))) })}
                  />
                </label>
                <label className="field">
                  <span className="sub">Son sete drop</span>
                  <NumberField
                    value={cfg.drops ?? 0}
                    onChange={(v) => patchEx(i, { drops: Math.min(MAX_DROPS, Math.max(0, Math.round(v))) })}
                  />
                </label>
              </div>

              <label className="field">
                <span className="sub">İlerleme</span>
                <select
                  className="input"
                  value={cfg.prog}
                  onChange={(e) => patchEx(i, { prog: e.target.value as ProgressionMode })}
                >
                  {(Object.keys(PROG_LABEL) as ProgressionMode[]).map((m) => (
                    <option key={m} value={m}>{PROG_LABEL[m]}</option>
                  ))}
                </select>
              </label>

              {cfg.prog !== 'off' && (
                <div className="grid3">
                  <label className="field">
                    <span className="sub">Artış ({unit})</span>
                    <NumberField
                      value={cfg.inc}
                      toDisplay={(v) => kgToUnit(v, unit)}
                      fromDisplay={(v) => unitToKg(v, unit)}
                      step={0.5}
                      onChange={(v) => patchEx(i, { inc: v })}
                    />
                  </label>
                  {cfg.prog === 'double' && (
                    <label className="field">
                      <span className="sub">Maks. tekrar</span>
                      <NumberField value={cfg.repsMax} min={1} onChange={(v) => patchEx(i, { repsMax: Math.round(v) })} />
                    </label>
                  )}
                </div>
              )}
            </div>
          </details>
        </div>
      ))}

      <button className="btn primary block" onClick={() => setPicking(true)}>+ Egzersiz ekle</button>

      {existing && (
        <button
          className="btn danger block dangerzone"
          onClick={() => {
            if (confirm(`"${existing.name}" rutini silinsin mi?`)) {
              deleteRoutine(existing.id)
              navigate('/plan')
            }
          }}
        >
          Rutini sil
        </button>
      )}

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Egzersiz seç">
        <ExerciseBrowser
          actionLabel="Ekle"
          onSelect={(ex) => {
            setDraft((d) => ({
              ...d,
              ex: [
                ...d.ex,
                {
                  exId: ex.id,
                  sets: 3,
                  reps: 8,
                  weight: 0,
                  prog: 'double',
                  inc: 2.5,
                  repsMax: 12,
                  side: isUnilateralName(ex.name),
                },
              ],
            }))
            setPicking(false)
          }}
        />
      </BottomSheet>
    </div>
  )
}
