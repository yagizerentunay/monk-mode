import { useMemo, useState } from 'react'
import { imageUrl, nameLang, type Exercise } from '../lib/exercises.ts'
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
        <button className="btn small" onClick={() => setBrowse(false)}>← Önerilere dön</button>
        <ExerciseBrowser actionLabel="Seç" onSelect={onSelect} />
      </div>
    )
  }

  if (error) return <p className="sub">Egzersizler yüklenemedi: {error}</p>

  return (
    <div className="stack">
      <p className="sub resultcount">
        {loading ? 'Yükleniyor…' : `${current.primaryMuscles[0] ? muscleLabel(current.primaryMuscles[0]) : 'Aynı kas'} için ${alternatives.length} alternatif`}
        {' · '}
        <span lang={nameLang(current)}>{current.name}</span> yerine
      </p>
      <div className="card" style={{ padding: '4px 14px' }}>
        {alternatives.map((e) => (
          <button key={e.id} className="exrow" onClick={() => onSelect(e)}>
            {e.images[0] ? (
              <img className="thumb" src={imageUrl(e.images[0])} alt="" loading="lazy" />
            ) : (
              <div className="thumb" />
            )}
            <div className="grow">
              <div className="exname" lang={nameLang(e)}>{e.name}</div>
              <div className="sub">{equipmentLabel(e.equipment)}</div>
            </div>
            <span className="exaction">Seç</span>
          </button>
        ))}
        {!loading && alternatives.length === 0 && <p className="sub">Aynı kası çalıştıran başka egzersiz bulunamadı.</p>}
      </div>
      <button className="btn block" onClick={() => setBrowse(true)}>Tüm egzersizlerde ara</button>
    </div>
  )
}
