import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { RestTimer } from '../components/RestTimer.tsx'
import { formatClock } from '../lib/alert.ts'
import { DAY_NAMES } from '../lib/dates.ts'
import { imageUrl } from '../lib/exercises.ts'
import { formatWeight, kgToUnit, unitToKg } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, isPR, lastEntryFor, workoutVolume } from '../lib/workout.ts'
import type { Workout as WorkoutT } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

const RIR_CHOICES = [0, 1, 2, 3, 4]

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
  const { updateSet, addSet, removeSet, addExerciseToActive, finishWorkout, discardWorkout } = useStore.getState()
  const { byId } = useExercises()
  const navigate = useNavigate()

  const [restEnds, setRestEnds] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState(false)
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
        const lastTop = last?.sets.filter((s) => s.done && !s.warmup).sort((a, b) => b.w - a.w)[0]
        return (
          <div key={ei} className="card stack">
            <div className="row">
              {ex?.images[0] && <img className="thumb" src={imageUrl(ex.images[0])} alt="" loading="lazy" />}
              <div className="grow">
                <div className="exname">{ex?.name ?? entry.exId}</div>
                <div className="sub">
                  {lastTop ? `Geçen sefer: ${formatWeight(lastTop.w, unit)} ${unit} × ${lastTop.r}` : 'İlk kez'}
                </div>
              </div>
            </div>

            {entry.sets.map((set, si) => (
              <div key={si} className={`set${set.done ? ' done' : ''}`}>
                <div className="setrow">
                  <span className="setno">{si + 1}</span>
                  <NumberField
                    className="grow"
                    label={`Set ${si + 1} ağırlık`}
                    value={set.w}
                    toDisplay={(v) => kgToUnit(v, unit)}
                    fromDisplay={(v) => unitToKg(v, unit)}
                    step={0.5}
                    onChange={(v) => updateSet(ei, si, { w: v })}
                  />
                  <span className="sub">{unit}</span>
                  <NumberField
                    className="grow"
                    label={`Set ${si + 1} tekrar`}
                    value={set.r}
                    onChange={(v) => updateSet(ei, si, { r: Math.round(v) })}
                  />
                  <span className="sub">tkr</span>
                  <button
                    className={`check${set.done ? ' on' : ''}`}
                    aria-label={set.done ? 'Seti geri al' : 'Seti tamamla'}
                    onClick={() => {
                      updateSet(ei, si, { done: !set.done })
                      if (!set.done) setRestEnds(Date.now() + restSec * 1000)
                    }}
                  >
                    ✓
                  </button>
                </div>
                {set.done && (
                  <div className="rirrow">
                    <span className="sub">RIR</span>
                    {RIR_CHOICES.map((r) => (
                      <button
                        key={r}
                        className={`chip${set.rir === r ? ' on' : ''}`}
                        onClick={() => updateSet(ei, si, { rir: set.rir === r ? undefined : r })}
                      >
                        {r === 4 ? '4+' : r}
                      </button>
                    ))}
                    <button className="chip" onClick={() => removeSet(ei, si)} aria-label="Seti sil">Sil</button>
                  </div>
                )}
              </div>
            ))}

            <button className="btn small" onClick={() => addSet(ei)}>+ Set ekle</button>
          </div>
        )
      })}

      <button className="btn block" onClick={() => setPicking(true)}>+ Egzersiz ekle</button>

      {restEnds && <RestTimer endsAt={restEnds} onChange={setRestEnds} />}

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Egzersiz ekle">
        <ExerciseBrowser
          actionLabel="Ekle"
          onSelect={(ex) => {
            addExerciseToActive(ex.id)
            setPicking(false)
          }}
        />
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
