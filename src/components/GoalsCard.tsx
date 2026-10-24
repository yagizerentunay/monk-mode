import { t } from '../i18n/index.ts'
import { useEffect, useMemo, useState } from 'react'
import { formatShortDay } from '../lib/calendar.ts'
import { exerciseSummary } from '../lib/exerciseStats.ts'
import { addDays, describeForecast, forecastGoal, goalHistory } from '../lib/goals.ts'
import { formatWeight, kgToUnit, unitToKg } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { dayString, newId } from '../lib/workout.ts'
import { isDay, MAX_GOAL_KG } from '../store/sanitize.ts'
import type { StrengthGoal } from '../store/schema.ts'
import { useToast } from '../store/toast.ts'
import { deleteGoalWithUndo } from '../store/undoDelete.ts'
import { useStore } from '../store/useStore.ts'
import { BottomSheet } from './BottomSheet.tsx'
import { NumberField } from './NumberField.tsx'

/** Yeni hedefin varsayılan günü: 12 hafta sonrası. */
const DEFAULT_WEEKS = 12

/** Analiz'de kuvvet hedefleri: hedef tahmini 1RM, ilerleme ve bu gidişle tahmini varış günü. */
export function GoalsCard() {
  const goals = useStore((s) => s.goals)
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const { byId } = useExercises()
  const [today] = useState(() => new Date())
  const [editing, setEditing] = useState<StrengthGoal | null>(null)

  const nameOf = (id: string) => byId.get(id)?.name ?? id

  // Tekrarlı (1RM'i olan) geçmişi olan egzersizler, en sık yapılandan başlayarak.
  const exIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of workouts) {
      for (const e of w.entries) if (!e.timed && !e.distance) counts.set(e.exId, (counts.get(e.exId) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .filter((id) => goalHistory(workouts, id).length > 0)
  }, [workouts])

  // Geçmiş değişince (içe aktarma, geçmişe antrenman ekleme, hedefi düzenleme) ulaşılan hedef bir kez kutlanır.
  // Antrenman bitişinde ulaşılan hedef orada işaretlenir; burada ikinci kez kutlanmaz.
  useEffect(() => {
    const reached = useStore.getState().settleGoals()
    if (reached.length > 0) {
      useToast.getState().show(`🎯 ${t('goals.reachedToast', { names: reached.map((g) => nameOf(g.exId)).join(', ') })}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workouts, goals])

  const todayStr = dayString(today)
  const newGoal = (): StrengthGoal => ({
    id: newId(),
    exId: exIds[0],
    target: 0,
    by: addDays(todayStr, DEFAULT_WEEKS * 7),
    created: todayStr,
  })

  return (
    <div className="card stack goals">
      <div>
        <div className="eyebrow">{t('goals.eyebrow')}</div>
        <h2 style={{ margin: 0 }}>{t('goals.title')}</h2>
      </div>
      {goals.length === 0 && (
        <p className="sub" style={{ margin: 0 }}>
          {exIds.length === 0 ? t('goals.needHistory') : t('goals.intro')}
        </p>
      )}
      {goals.map((g) => {
        const f = forecastGoal(g, workouts, todayStr)
        const current = f.current
        const pct = current ? Math.min(100, Math.round((current / g.target) * 100)) : 0
        return (
          <div key={g.id} className="goal-row stack" data-goal={g.id}>
            <div className="row between">
              <div className="grow">
                <div className="exname">{nameOf(g.exId)}</div>
                <div className="sub">
                  {t('goals.target1rm', { value: `${formatWeight(g.target, unit)} ${unit}` })} · {formatShortDay(g.by, today)}
                </div>
              </div>
              {f.kind === 'reached' && <span className="badge ok">🎯 {t('goals.reached')}</span>}
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label={t('goals.progressAria')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={f.kind === 'reached' ? 100 : pct}
            >
              <div style={{ width: `${f.kind === 'reached' ? 100 : pct}%` }} />
            </div>
            {current !== undefined && (
              <div className="sub">
                {t('goals.best8', { value: `${formatWeight(current, unit)} / ${formatWeight(g.target, unit)} ${unit}` })}
              </div>
            )}
            <div className={`goal-forecast goal-${f.kind === 'eta' ? f.status : f.kind}`}>{describeForecast(f, g, unit, today)}</div>
            <div className="row">
              <button className="btn small" onClick={() => setEditing(g)}>{t('common.edit')}</button>
              <button className="btn small" onClick={() => deleteGoalWithUndo(g.id)}>{t('set.delete')}</button>
            </div>
          </div>
        )
      })}
      {exIds.length > 0 && (
        <button className="btn block" onClick={() => setEditing(newGoal())}>+ {t('goals.add')}</button>
      )}
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && goals.some((g) => g.id === editing.id) ? t('goals.edit') : t('goals.new')}
      >
        {editing && (
          <GoalForm
            key={editing.id}
            initial={editing}
            exIds={exIds.includes(editing.exId) ? exIds : [editing.exId, ...exIds]}
            nameOf={nameOf}
            onCancel={() => setEditing(null)}
            onSave={(g) => {
              useStore.getState().saveGoal(g)
              setEditing(null)
            }}
          />
        )}
      </BottomSheet>
    </div>
  )
}

interface FormProps {
  initial: StrengthGoal
  exIds: string[]
  nameOf: (id: string) => string
  onSave: (goal: StrengthGoal) => void
  onCancel: () => void
}

function GoalForm({ initial, exIds, nameOf, onSave, onCancel }: FormProps) {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const [exId, setExId] = useState(initial.exId)
  const [target, setTarget] = useState(initial.target)
  const [by, setBy] = useState(initial.by)
  const best = exerciseSummary(workouts, exId).best?.e1rm
  const valid = !!exId && target > 0 && target <= MAX_GOAL_KG && isDay(by)

  const save = () => {
    if (!valid) return
    // Egzersiz ya da hedef değişirse ulaşma yeniden değerlendirilir (gerekirse yeniden kutlanır).
    const { done: _done, ...rest } = initial
    const changed = exId !== initial.exId || target !== initial.target
    onSave({ ...(changed ? rest : initial), exId, target, by })
  }

  return (
    <div className="stack">
      <label className="field">
        <span className="sub">{t('stats.exerciseAria')}</span>
        <select className="input" value={exId} onChange={(e) => setExId(e.target.value)} aria-label={t('goals.exerciseAria')}>
          {exIds.map((id) => (
            <option key={id} value={id}>{nameOf(id)}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="sub">{t('goals.targetE1rm', { unit })}</span>
        <NumberField
          value={target}
          label={t('goals.target1rmAria')}
          step={unit === 'lb' ? 5 : 2.5}
          toDisplay={(kg) => kgToUnit(kg, unit)}
          fromDisplay={(v) => unitToKg(v, unit)}
          onChange={(v) => setTarget(Math.max(0, v))}
        />
      </label>
      {best !== undefined && <div className="sub">{t('goals.bestSoFar', { value: `${formatWeight(best, unit)} ${unit}` })}</div>}
      <label className="field">
        <span className="sub">{t('goals.targetDate')}</span>
        <input className="input" type="date" value={by} onChange={(e) => setBy(e.target.value)} aria-label={t('goals.targetDate')} />
      </label>
      <div className="row">
        <button className="btn small grow" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary small grow" disabled={!valid} onClick={save}>{t('common.save')}</button>
      </div>
    </div>
  )
}
