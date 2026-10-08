import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BodyweightCard } from '../components/BodyweightCard.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { MuscleCard } from '../components/MuscleCard.tsx'
import { formatSet } from '../lib/sets.ts'
import { formatWeight, kgToUnit } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, exerciseHistory, workoutVolume } from '../lib/workout.ts'
import type { Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

type Metric = 'e1rm' | 'topW'

function WorkoutDetail({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const { byId } = useExercises()
  const unit = useStore((s) => s.settings.unit)
  const routines = useStore((s) => s.routines)
  const hasActive = useStore((s) => s.active !== null)
  const startWorkout = useStore((s) => s.startWorkout)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const navigate = useNavigate()
  const canRepeat = !hasActive && routines.some((r) => r.id === workout.routineId)

  return (
    <div className="stack">
      <div className="sub">{workout.d} · {formatWeight(workoutVolume(workout), unit)} {unit} hacim</div>
      {workout.entries.map((e, i) => (
        <div key={i}>
          <div className="exname">{byId.get(e.exId)?.name ?? e.exId}</div>
          <div className="sub">
            {e.sets
              .filter((s) => !s.warmup)
              .map((s) => formatSet(s, formatWeight(s.w, unit)))
              .join(' · ')}
          </div>
        </div>
      ))}
      <div className="row">
        {canRepeat && (
          <button
            className="btn primary grow"
            onClick={() => {
              startWorkout(workout.routineId!)
              navigate('/workout')
            }}
          >
            Rutini tekrarla
          </button>
        )}
        <button
          className="btn danger grow"
          onClick={() => {
            if (confirm('Bu antrenman geçmişten silinsin mi?')) {
              deleteWorkout(workout.id)
              onClose()
            }
          }}
        >
          Sil
        </button>
      </div>
    </div>
  )
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

  return (
    <div className="stack">
      <h1>İstatistik</h1>

      <div className="card stack">
        <h2>Egzersiz ilerlemesi</h2>
        {exIds.length === 0 ? (
          <p className="sub">İlk antrenmanını bitirince grafik burada görünür.</p>
        ) : (
          <>
            <select className="input" value={selected} onChange={(e) => setChosen(e.target.value)}>
              {exIds.map((id) => (
                <option key={id} value={id}>{byId.get(id)?.name ?? id}</option>
              ))}
            </select>
            <div className="chips">
              <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} onClick={() => setMetric('e1rm')}>Tahmini 1RM</button>
              <button className={`chip${metric === 'topW' ? ' on' : ''}`} onClick={() => setMetric('topW')}>En ağır set</button>
            </div>
            <LineChart points={points} unit={unit} />
          </>
        )}
      </div>

      <BodyweightCard />

      <MuscleCard />

      <div className="card stack">
        <h2>Son antrenmanlar</h2>
        {recent.length === 0 && <p className="sub">Henüz antrenman yok.</p>}
        {recent.map((w) => (
          <button key={w.id} className="exrow" onClick={() => setOpenId(w.id)}>
            <div className="grow">
              <div className="exname">{w.name}</div>
              <div className="sub">{w.d} · {doneSetCount(w).done} set</div>
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
