import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { PlateCalculator } from '../components/PlateCalculator.tsx'
import { RestTimer } from '../components/RestTimer.tsx'
import { SetRow } from '../components/SetRow.tsx'
import { formatClock } from '../lib/alert.ts'
import { DAY_NAMES } from '../lib/dates.ts'
import { imageUrl, isUnilateralName } from '../lib/exercises.ts'
import { describeSets, MAX_WARMUPS, restAfterSec } from '../lib/intensity.ts'
import { plateTargets } from '../lib/plates.ts'
import { formatSet } from '../lib/sets.ts'
import { formatWeight } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, isPR, lastEntryFor, workoutVolume } from '../lib/workout.ts'
import type { Workout as WorkoutT } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

interface Summary {
  workout: WorkoutT
  prs: string[]
}

function Starter() {
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const start = useStore((s) => s.startWorkout)
  const navigate = useNavigate()
  const [today] = useState(() => new Date().getDay())
  const todayId = week[today]

  return (
    <div className="stack">
      <h1>Antrenmanı başlat</h1>
      {routines.length === 0 && (
        <div className="card stack">
          <p className="sub" style={{ margin: 0 }}>Henüz rutinin yok.</p>
          <button className="btn primary" onClick={() => navigate('/plan')}>Rutin oluştur</button>
        </div>
      )}
      {routines.map((r) => (
        <button key={r.id} className="card tap row between" onClick={() => start(r.id)}>
          <div>
            <div className="exname">{r.name}</div>
            <div className="sub">
              {r.ex.length} egzersiz{r.id === todayId ? ` · bugün (${DAY_NAMES[today]})` : ''}
            </div>
          </div>
          <span className={r.id === todayId ? 'badge on' : 'badge'}>Başla ▶</span>
        </button>
      ))}
    </div>
  )
}

export function Workout() {
  const active = useStore((s) => s.active)
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const restSec = useStore((s) => s.settings.restSec)
  const {
    updateSet,
    updateSide,
    toggleUnilateral,
    addSet,
    addWarmup,
    addDrop,
    removeSet,
    addExerciseToActive,
    finishWorkout,
    discardWorkout,
  } = useStore.getState()
  const { byId } = useExercises()
  const navigate = useNavigate()

  const [restEnds, setRestEnds] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState(false)
  /** Plaka hesaplayıcısı açık olan egzersizin sırası. */
  const [plateEntry, setPlateEntry] = useState<number | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  if (summary) {
    const { workout, prs } = summary
    const mins = Math.max(1, Math.round(((workout.end ?? workout.start) - workout.start) / 60000))
    return (
      <div className="stack">
        <h1>Tamamlandı 🎉</h1>
        <div className="card stack">
          <div className="row between"><span className="sub">Süre</span><b>{mins} dk</b></div>
          <div className="row between"><span className="sub">Tamamlanan set</span><b>{doneSetCount(workout).done}</b></div>
          <div className="row between"><span className="sub">Toplam hacim</span><b>{formatWeight(workoutVolume(workout), unit)} {unit}</b></div>
        </div>
        {prs.length > 0 && (
          <div className="card stack">
            <h2>Yeni rekorlar 🏆</h2>
            {prs.map((p) => <div key={p}>{p}</div>)}
          </div>
        )}
        <button className="btn primary block" onClick={() => navigate('/')}>Ana sayfaya dön</button>
      </div>
    )
  }

  if (!active) return <Starter />

  const { done, total } = doneSetCount(active)
  const elapsed = (now - active.start) / 1000

  const finish = () => {
    const unfinished = total - done
    if (unfinished > 0 && !confirm(`${unfinished} set tamamlanmadı. Yine de bitirilsin mi?`)) return
    const prs = active.entries
      .filter((e) => isPR(workouts, { ...e, sets: e.sets.filter((x) => x.done) }))
      .map((e) => byId.get(e.exId)?.name ?? e.exId)
    const finished = finishWorkout()
    setRestEnds(null)
    if (finished) setSummary({ workout: finished, prs })
    else navigate('/')
  }

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 0 }}>{active.name}</h1>
          <div className="sub">{formatClock(elapsed)} · {done}/{total} set</div>
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setMenu(true)} aria-label="Menü">⋯</button>
          <button className="btn primary small" onClick={finish}>Bitir</button>
        </div>
      </div>
      <div className="progress"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>

      {active.entries.map((entry, ei) => {
        const ex = byId.get(entry.exId)
        const last = lastEntryFor(workouts, entry.exId)
        const lastTop = last?.sets.filter((s) => s.done && !s.warmup && !s.drop).sort((a, b) => b.w - a.w)[0]
        return (
          <div key={ei} className="card stack">
            <div className="row">
              {ex?.images[0] && <img className="thumb" src={imageUrl(ex.images[0])} alt="" loading="lazy" />}
              <div className="grow">
                <div className="exname">{ex?.name ?? entry.exId}</div>
                <div className="sub">
                  {lastTop ? `Geçen sefer: ${formatSet(lastTop, `${formatWeight(lastTop.w, unit)} ${unit}`)}` : 'İlk kez'}
                </div>
              </div>
            </div>

            {(() => {
              const meta = describeSets(entry.sets)
              return entry.sets.map((set, si) => (
                <SetRow
                  key={si}
                  name={meta[si].name}
                  badge={meta[si].badge}
                  kind={meta[si].kind}
                  canDrop={meta[si].canDrop}
                  set={set}
                  unilateral={!!entry.unilateral}
                  unit={unit}
                  onChange={(patch) => updateSet(ei, si, patch)}
                  onSide={(side, patch) => updateSide(ei, si, side, patch)}
                  onDrop={() => addDrop(ei, si)}
                  onRemove={() => removeSet(ei, si)}
                  onCompleted={() => {
                    const rest = restAfterSec(entry.sets, si, restSec)
                    if (rest !== null) setRestEnds(Date.now() + rest * 1000)
                  }}
                />
              ))
            })()}

            <div className="row wrap">
              <button className="btn small" onClick={() => addSet(ei)}>+ Set ekle</button>
              <button
                className="btn small"
                disabled={entry.sets.filter((s) => s.warmup).length >= MAX_WARMUPS}
                onClick={() => addWarmup(ei)}
              >
                + Isınma
              </button>
              <button className="btn small" onClick={() => setPlateEntry(ei)}>Plakalar</button>
              <button
                className={`chip${entry.unilateral ? ' on' : ''}`}
                aria-pressed={!!entry.unilateral}
                onClick={() => toggleUnilateral(ei)}
              >
                Tek taraflı (sol/sağ)
              </button>
            </div>
          </div>
        )
      })}

      <button className="btn block" onClick={() => setPicking(true)}>+ Egzersiz ekle</button>

      {restEnds && <RestTimer endsAt={restEnds} onChange={setRestEnds} />}

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Egzersiz ekle">
        <ExerciseBrowser
          actionLabel="Ekle"
          onSelect={(ex) => {
            addExerciseToActive(ex.id, { side: isUnilateralName(ex.name) })
            setPicking(false)
          }}
        />
      </BottomSheet>

      <BottomSheet open={plateEntry !== null} onClose={() => setPlateEntry(null)} title="Plaka hesaplayıcı">
        {plateEntry !== null && active.entries[plateEntry] && (
          <PlateCalculator
            initialKg={plateTargets(active.entries[plateEntry].sets).initial}
            weights={plateTargets(active.entries[plateEntry].sets).weights}
          />
        )}
      </BottomSheet>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Antrenman">
        <button
          className="btn danger block"
          onClick={() => {
            if (confirm('Bu antrenman silinsin mi? Kaydedilmeyecek.')) {
              discardWorkout()
              setRestEnds(null)
              setMenu(false)
            }
          }}
        >
          Antrenmanı at
        </button>
      </BottomSheet>
    </div>
  )
}
