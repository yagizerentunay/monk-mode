import { useMemo, useRef, useState } from 'react'
import { t } from '../i18n/index.ts'
import { parseImport } from '../lib/importCsv.ts'
import type { ParsedImport } from '../lib/importTypes.ts'
import { buildImport } from '../lib/importWorkouts.ts'
import { buildLibraryMatcher } from '../lib/matchExercise.ts'
import type { Unit } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { useStore } from '../store/useStore.ts'
import { ChipRow } from './ChipRow.tsx'

const FORMAT_LABEL = { strong: 'Strong', hevy: 'Hevy' } as const

/** Strong veya Hevy CSV dosyasını önizleyip onayla içe aktarır; veri yalnız bu tarayıcıya yazılır. */
export function ImportCard() {
  const workouts = useStore((s) => s.workouts)
  const customEx = useStore((s) => s.customEx)
  const appUnit = useStore((s) => s.settings.unit)
  const importWorkouts = useStore((s) => s.importWorkouts)
  const { list, legacy, loading } = useExercises({ legacy: true })
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [fileUnit, setFileUnit] = useState<Unit>(appUnit)
  const [message, setMessage] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  const matcher = useMemo(() => buildLibraryMatcher(list, legacy), [list, legacy])
  const unit = parsed?.unit ?? fileUnit
  const plan = useMemo(
    () => (parsed ? buildImport(parsed, unit, matcher, workouts, customEx) : null),
    [parsed, unit, matcher, workouts, customEx],
  )

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    setParsed(null)
    try {
      const result = parseImport(await file.text())
      if (result.workouts.length === 0) throw new Error(t('import.noWorkouts'))
      setParsed(result)
      setShowMap(false)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const commit = () => {
    if (!plan) return
    void snapshotNow(t('snapshot.beforeImport'))
    importWorkouts(plan.workouts, plan.newCustom)
    setMessage(
      t('import.done', { workouts: t('count.workouts', { n: plan.workouts.length }), sets: t('count.sets', { n: plan.sets }) }) +
        (plan.newCustom.length ? `, ${t('import.newCustom', { n: plan.newCustom.length })}.` : '.'),
    )
    setParsed(null)
  }

  const matched = plan?.mappings.filter((m) => !m.custom).length ?? 0
  const first = parsed?.workouts[0]?.date
  const last = parsed?.workouts[parsed.workouts.length - 1]?.date

  return (
    <div className="card stack importcard">
      <div className="eyebrow">{t('import.eyebrow')}</div>
      <h2>{t('import.title')}</h2>
      <p className="sub" style={{ margin: 0 }}>
        {t('import.hint')}
      </p>
      <button className="btn block" disabled={loading} onClick={() => fileRef.current?.click()}>
        {t('import.choose')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {parsed && plan && (
        <div className="stack">
          <div className="row between">
            <span className="sub">{t('import.format')}</span>
            <b>{FORMAT_LABEL[parsed.format]}</b>
          </div>
          <div className="row between">
            <span className="sub">{t('import.workouts')}</span>
            <b>{plan.workouts.length}{plan.duplicates > 0 ? ` (${t('import.duplicates', { n: plan.duplicates })})` : ''}</b>
          </div>
          <div className="row between">
            <span className="sub">{t('import.range')}</span>
            <b>{first} – {last}</b>
          </div>
          <div className="row between">
            <span className="sub">{t('card.sets')}</span>
            <b>{plan.sets}</b>
          </div>
          <div className="row between">
            <span className="sub">{t('import.unit')}</span>
            {parsed.unit ? (
              <b>{t('import.unitFromFile', { unit: parsed.unit })}</b>
            ) : (
              <ChipRow>
                {(['kg', 'lb'] as const).map((u) => (
                  <button key={u} className={`chip${fileUnit === u ? ' on' : ''}`} onClick={() => setFileUnit(u)}>
                    {u}
                  </button>
                ))}
              </ChipRow>
            )}
          </div>
          {!parsed.unit && (
            <p className="warntext" style={{ margin: 0 }}>
              {t('import.unitWarning')}
            </p>
          )}
          <div className="sub">
            {t('import.matched', { matched: t('count.exercises', { n: matched }), custom: plan.newCustom.length })}
            <button className="linkbtn" onClick={() => setShowMap((v) => !v)}>
              {showMap ? t('import.hide') : t('import.showMatches')}
            </button>
          </div>
          {showMap && (
            <div className="importmap">
              {plan.mappings.map((m) => (
                <div key={m.exId + m.name} className="row between">
                  <span>{m.name}</span>
                  <span className={m.custom ? 'warntext' : 'sub'}>
                    {m.custom ? t('import.newCustomShort') : `→ ${m.target}`} · {m.sets}
                  </span>
                </div>
              ))}
            </div>
          )}
          {parsed.warnings.map((w) => (
            <p key={w} className="warntext" style={{ margin: 0 }}>{w}</p>
          ))}
          <div className="row">
            <button className="btn primary grow" disabled={plan.workouts.length === 0} onClick={commit}>
              {t('import.import')}
            </button>
            <button className="btn grow" onClick={() => setParsed(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
