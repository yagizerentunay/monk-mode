import { useMemo, useState } from 'react'
import { MUSCLE_LABEL, MUSCLES, muscleLevel, muscleSets, sinceDay, WEEKLY_TARGET_SETS, type MuscleId } from '../lib/muscles.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'
import { MuscleMap } from './MuscleMap.tsx'

const PERIODS = [7, 30] as const

/** 6,5 gibi: tam sayıda ondalık yok, ondalık ayracı virgül. */
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

/** Son 7 veya 30 günde kas başına ağırlıklı set sayısını gövde şemasında ve listede gösterir. */
export function MuscleCard() {
  const workouts = useStore((s) => s.workouts)
  const { byId } = useExercises()
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const [selected, setSelected] = useState<MuscleId | null>(null)

  const sets = useMemo(() => muscleSets(workouts, byId, { from: sinceDay(days) }), [workouts, byId, days])
  const levels = useMemo(
    () => Object.fromEntries(MUSCLES.map((m) => [m, muscleLevel(sets[m], days)])) as Record<MuscleId, number>,
    [sets, days],
  )

  const worked = MUSCLES.filter((m) => sets[m] > 0).sort((a, b) => sets[b] - sets[a])
  const idle = MUSCLES.filter((m) => sets[m] === 0)
  const target = (WEEKLY_TARGET_SETS * days) / 7

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Kas dağılımı</div>
        <h2 style={{ margin: 0 }}>Kas haritası</h2>
      </div>
      <div className="chips statseg">
        {PERIODS.map((p) => (
          <button key={p} className={`chip${days === p ? ' on' : ''}`} onClick={() => setDays(p)}>
            Son {p} gün
          </button>
        ))}
      </div>

      <MuscleMap
        levels={levels}
        labels={MUSCLE_LABEL}
        selected={selected}
        onSelect={(m) => setSelected((cur) => (cur === m ? null : m))}
      />

      {selected && (
        <div className="musclesel" role="status">
          <b>{MUSCLE_LABEL[selected]}</b>: {fmt(sets[selected])} set (varsayılan hedef {fmt(target)})
        </div>
      )}

      {worked.length === 0 ? (
        <p className="sub" style={{ margin: 0 }}>Bu dönemde tamamlanmış set yok. İlk antrenmanını bitirince dağılım burada görünür.</p>
      ) : (
        <div className="stack">
          {worked.map((m) => (
            <button
              key={m}
              className={`musclerow${selected === m ? ' on' : ''}`}
              onClick={() => setSelected((cur) => (cur === m ? null : m))}
            >
              <span className="mrname">{MUSCLE_LABEL[m]}</span>
              <span className="mrbar" aria-hidden="true"><span style={{ width: `${levels[m] * 100}%` }} /></span>
              <span className="mrval">{fmt(sets[m])}</span>
            </button>
          ))}
        </div>
      )}

      {idle.length > 0 && worked.length > 0 && (
        <div className="sub">Çalışmayan: {idle.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
      )}
      <div className="sub">
        Birincil kas 1, yardımcı kas 0,5 set sayılır; ısınma seti sayılmaz. Varsayım: haftada kas başına {WEEKLY_TARGET_SETS} set; kesin hedef değil, yaklaşık bir ölçüdür.
      </div>
    </div>
  )
}
