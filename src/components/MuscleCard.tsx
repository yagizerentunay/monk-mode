import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmt } from '../lib/muscleWeek.ts'
import {
  MUSCLE_LABEL,
  MUSCLES,
  muscleLevel,
  muscleSets,
  sinceDay,
  targetFor,
  weekComparison,
  WEEKLY_TARGET_SETS,
  type MuscleId,
} from '../lib/muscles.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'
import { MuscleMap } from './MuscleMap.tsx'
import { MuscleWeekList } from './MuscleWeekList.tsx'

const PERIODS = [7, 30] as const
type Period = (typeof PERIODS)[number] | 'week'

/**
 * Kas başına ağırlıklı set sayısını gövde şemasında ve listede gösterir.
 * "Son 7 / 30 gün" kayan penceredir; "Bu hafta" kullanıcının hafta başlangıcına göre takvim haftasıdır
 * ve geçen tam haftayla karşılaştırır. Hedefler Ayarlar'dan kas başına ayarlanır (varsayılan 10 set).
 */
export function MuscleCard() {
  const workouts = useStore((s) => s.workouts)
  const weekStart = useStore((s) => s.settings.weekStart)
  const targets = useStore((s) => s.settings.muscleTargets)
  const { byId } = useExercises()
  const [period, setPeriod] = useState<Period>(7)
  const [selected, setSelected] = useState<MuscleId | null>(null)
  const [showAllBehind, setShowAllBehind] = useState(false)

  const isWeek = period === 'week'
  const days = isWeek ? 7 : period

  const cmp = useMemo(
    () => (isWeek ? weekComparison(workouts, byId, undefined, weekStart) : null),
    [isWeek, workouts, byId, weekStart],
  )
  const rolling = useMemo(
    () => (isWeek ? null : muscleSets(workouts, byId, { from: sinceDay(days) })),
    [isWeek, workouts, byId, days],
  )
  const sets = cmp ? cmp.thisWeek : rolling!
  const levels = useMemo(
    () =>
      Object.fromEntries(MUSCLES.map((m) => [m, muscleLevel(sets[m], days, targetFor(targets, m))])) as Record<
        MuscleId,
        number
      >,
    [sets, days, targets],
  )

  // Kayan dönemlerde yalnız çalışılmış kaslar listelenir. "Bu hafta" listesi MuscleWeekList'te: hedefi olan
  // çalışılmamış kaslar da orada 0/hedef olarak görünür.
  const worked = MUSCLES.filter((m) => sets[m] > 0).sort((a, b) => sets[b] - sets[a])
  const idle = MUSCLES.filter((m) => !worked.includes(m))
  const toggle = (m: MuscleId) => setSelected((cur) => (cur === m ? null : m))
  const selTarget = selected ? targetFor(targets, selected) : 0

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Kas dağılımı</div>
        <h2 style={{ margin: 0 }}>Kas haritası</h2>
      </div>
      <div className="chips statseg">
        {PERIODS.map((p) => (
          <button key={p} className={`chip${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>
            Son {p} gün
          </button>
        ))}
        <button className={`chip${isWeek ? ' on' : ''}`} onClick={() => setPeriod('week')}>
          Bu hafta
        </button>
      </div>

      <MuscleMap levels={levels} labels={MUSCLE_LABEL} selected={selected} onSelect={toggle} />

      {selected && (
        <div className="musclesel" role="status">
          <b>{MUSCLE_LABEL[selected]}</b>: {fmt(sets[selected])} set (
          {selTarget > 0 ? `hedef ${fmt((selTarget * days) / 7)}` : 'hedef yok'})
          {cmp && <>, geçen hafta {fmt(cmp.lastWeek[selected])}</>}
        </div>
      )}

      {cmp ? (
        <MuscleWeekList
          cmp={cmp}
          targets={targets}
          selected={selected}
          onSelect={toggle}
          showAll={showAllBehind}
          onToggleAll={() => setShowAllBehind((v) => !v)}
        />
      ) : (
        <>
          {worked.length === 0 ? (
            <p className="sub" style={{ margin: 0 }}>
              Bu dönemde tamamlanmış set yok. İlk antrenmanını bitirince dağılım burada görünür.
            </p>
          ) : (
            <div className="stack">
              {worked.map((m) => (
                <button
                  key={m}
                  className={`musclerow${selected === m ? ' on' : ''}`}
                  onClick={() => toggle(m)}
                >
                  <span className="mrname">{MUSCLE_LABEL[m]}</span>
                  <span className="mrbar" aria-hidden="true"><span style={{ width: `${levels[m] * 100}%` }} /></span>
                  <span className="mrval">{fmt(sets[m])}</span>
                </button>
              ))}
            </div>
          )}
          {idle.length > 0 && worked.length > 0 && <div className="sub">Çalışmayan: {idle.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>}
        </>
      )}

      <div className="sub">
        Birincil kas 1, yardımcı kas 0,5 set sayılır; ısınma seti sayılmaz. Hedef, varsayılan olarak haftada kas başına {WEEKLY_TARGET_SETS} settir; kesin bilimsel bir hedef değil, ayarlanabilir bir kılavuzdur.{isWeek && ' Hafta, ayarlardaki hafta başlangıcına göre hesaplanır.'}{' '}
        <Link to="/settings">Hedefleri ayarla</Link>
      </div>
    </div>
  )
}
