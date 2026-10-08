import { useMemo, useState } from 'react'
import { BodyweightCard } from '../components/BodyweightCard.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { MuscleCard } from '../components/MuscleCard.tsx'
import { WorkoutDetail } from '../components/WorkoutDetail.tsx'
import { formatShortDay } from '../lib/calendar.ts'
import { formatWeight, kgToUnit } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, exerciseHistory, workoutVolume } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

type Metric = 'e1rm' | 'topW'

/** 2,5 gibi: ondalık ayracı virgül. */
function fmtNum(n: number): string {
  return n.toString().replace('.', ',')
}

export function Stats() {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const { byId } = useExercises()
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [chosen, setChosen] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // Geçmişi olan egzersizler, en sık yapılandan başlayarak.
  const exIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of workouts) for (const e of w.entries) counts.set(e.exId, (counts.get(e.exId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [workouts])

  const selected = chosen && exIds.includes(chosen) ? chosen : exIds[0]
  const points = selected
    ? exerciseHistory(workouts, selected).map((p) => ({
        label: p.d.slice(5),
        value: Math.round(kgToUnit(metric === 'e1rm' ? p.e1rm : p.topW, unit) * 10) / 10,
      }))
    : []
  const open = workouts.find((w) => w.id === openId) ?? null
  const recent = [...workouts].reverse().slice(0, 30)

  const metricLabel = metric === 'e1rm' ? 'tahmini 1RM' : 'en ağır set'
  const lastPt = points[points.length - 1]
  const prevPt = points.length >= 2 ? points[points.length - 2] : null
  // Değişim yalnız iki seans varsa hesaplanır; veri yoksa uydurulmaz.
  const delta = lastPt && prevPt ? Math.round((lastPt.value - prevPt.value) * 10) / 10 : null

  return (
    <div className="stack statsview">
      <header>
        <div className="eyebrow">Performans analizi</div>
        <h1 className="display">Her set<span className="hl">bir adım.</span></h1>
      </header>

      <div className="card stack">
        <div>
          <div className="eyebrow">Güç gelişimi</div>
          <h2 style={{ margin: 0 }}>Egzersiz ilerlemesi</h2>
        </div>
        {exIds.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>İlk antrenmanını bitirince güç gelişimin burada görünür. Her tamamlanan set grafiğe bir nokta ekler.</p>
        ) : (
          <>
            <select className="input" value={selected} onChange={(e) => setChosen(e.target.value)} aria-label="Egzersiz">
              {exIds.map((id) => (
                <option key={id} value={id}>{byId.get(id)?.name ?? id}</option>
              ))}
            </select>
            {lastPt && (
              <div>
                <div className="row statbig">
                  <span className="bignum">{fmtNum(lastPt.value)}</span>
                  <span className="statunit">{unit} · {metricLabel}</span>
                </div>
                {delta === null ? (
                  <div className="sub">Karşılaştırma için bir seans daha gerekli.</div>
                ) : (
                  <div className={`statdelta${delta > 0 ? ' up' : ''}`}>
                    {delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '= '}{fmtNum(delta)} {unit} · önceki seansa göre
                  </div>
                )}
              </div>
            )}
            <LineChart points={points} unit={unit} />
            <div className="chips statseg" role="group" aria-label="Ölçü">
              <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>Tahmini 1RM</button>
              <button className={`chip${metric === 'topW' ? ' on' : ''}`} aria-pressed={metric === 'topW'} onClick={() => setMetric('topW')}>En ağır set</button>
            </div>
          </>
        )}
      </div>

      <BodyweightCard />

      <MuscleCard />

      <div className="card stack">
        <div>
          <div className="eyebrow">Geçmiş</div>
          <h2 style={{ margin: 0 }}>Son antrenmanlar</h2>
        </div>
        {recent.length === 0 && <p className="sub" style={{ margin: 0 }}>Henüz antrenman yok. Bitirdiğin antrenmanlar burada listelenir.</p>}
        {recent.map((w) => (
          <button key={w.id} className="exrow" onClick={() => setOpenId(w.id)}>
            <div className="grow">
              <div className="exname">{w.name}</div>
              <div className="sub">{formatShortDay(w.d)} · {doneSetCount(w).done} set</div>
            </div>
            <span className="sub">{formatWeight(workoutVolume(w), unit)} {unit}</span>
          </button>
        ))}
      </div>

      <BottomSheet open={!!open} onClose={() => setOpenId(null)} title={open?.name}>
        {open && <WorkoutDetail workout={open} onClose={() => setOpenId(null)} />}
      </BottomSheet>
    </div>
  )
}
