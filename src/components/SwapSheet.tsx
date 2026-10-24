import { t, tNodes } from '../i18n/index.ts'
import { useMemo, useState } from 'react'
import { nameLang, type Exercise } from '../lib/exercises.ts'
import { ExerciseThumb } from './ExerciseThumb.tsx'
import { equipmentLabel, muscleLabel } from '../lib/labels.ts'
import { alternativesFor } from '../lib/swap.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'
import { ExerciseBrowser } from './ExerciseBrowser.tsx'

interface Props {
  current: Exercise
  /** Antrenmanda zaten bulunan egzersizler; öneri listesinde yer almaz. */
  excludeIds: Set<string>
  onSelect: (ex: Exercise) => void
}

/** "Egzersizi değiştir" içeriği: aynı kası çalıştıran sıralı alternatifler; istenirse tüm kütüphanede arama. */
export function SwapSheet({ current, excludeIds, onSelect }: Props) {
  const { list, loading, error } = useExercises()
  const workouts = useStore((s) => s.workouts)
  const [browse, setBrowse] = useState(false)

  const alternatives = useMemo(() => {
    const used = new Set(workouts.flatMap((w) => w.entries.map((e) => e.exId)))
    return alternativesFor(current, list, excludeIds, used)
  }, [current, list, excludeIds, workouts])

  if (browse) {
    return (
      <div className="stack">
        <button className="btn small" onClick={() => setBrowse(false)}>← {t('swap.backToSuggestions')}</button>
        <ExerciseBrowser actionLabel={t('swap.select')} onSelect={onSelect} />
      </div>
    )
  }

  if (error) return <p className="sub">{t('exercises.loadFailed', { error })}</p>

  return (
    <div className="stack">
      <p className="sub resultcount">
        {loading
          ? t('common.loading')
          : t('swap.alternatives', {
              muscle: current.primaryMuscles[0] ? muscleLabel(current.primaryMuscles[0]) : t('swap.sameMuscle'),
              n: alternatives.length,
            })}
        {' · '}
        {tNodes('swap.insteadOf', { name: <span lang={nameLang(current)}>{current.name}</span> })}
      </p>
      <div className="card" style={{ padding: '4px 14px' }}>
        {alternatives.map((e) => (
          <button key={e.id} className="exrow" onClick={() => onSelect(e)}>
            <ExerciseThumb ex={e} />
            <div className="grow">
              <div className="exname" lang={nameLang(e)}>{e.name}</div>
              <div className="sub">{equipmentLabel(e.equipment)}</div>
            </div>
            <span className="exaction">{t('swap.select')}</span>
          </button>
        ))}
        {!loading && alternatives.length === 0 && <p className="sub">{t('swap.none')}</p>}
      </div>
      <button className="btn block" onClick={() => setBrowse(true)}>{t('swap.searchAll')}</button>
    </div>
  )
}
