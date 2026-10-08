import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackupReminder } from '../components/BackupReminder.tsx'
import { BodyweightTrend } from '../components/BodyweightTrend.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { DAY_NAMES, DAY_SHORT } from '../lib/dates.ts'
import { weekStartOf, weekStreak } from '../lib/streak.ts'
import { formatWeight, kgToUnit, unitToKg } from '../lib/units.ts'
import { dayString } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

export function Home() {
  const navigate = useNavigate()
  const { routines, week, workouts, active, bodyweight } = useStore()
  const { unit, weekStart } = useStore((s) => s.settings)
  const startWorkout = useStore((s) => s.startWorkout)
  const logBodyweight = useStore((s) => s.logBodyweight)

  const [today] = useState(() => new Date())
  const [logging, setLogging] = useState(false)
  const [draftW, setDraftW] = useState(0)

  const todayKey = dayString(today)
  const monday = weekStartOf(today, weekStart)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    return { date: d, key: dayString(d), dow: d.getDay() }
  })
  const trainedDays = new Set(workouts.map((w) => w.d))

  const todayRoutine = routines.find((r) => r.id === week[today.getDay()])
  const doneToday = trainedDays.has(todayKey)
  const streak = weekStreak(workouts, today, weekStart)
  const monthPrefix = todayKey.slice(0, 7)
  const thisMonth = workouts.filter((w) => w.d.startsWith(monthPrefix)).length
  const lastBw = bodyweight[bodyweight.length - 1]

  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>monk-mode</h1>
          <div className="sub">{DAY_NAMES[today.getDay()]}, {today.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</div>
        </div>
        <Link to="/settings" className="btn small" aria-label="Ayarlar">⚙</Link>
      </div>

      <BackupReminder />

      <div className="weekstrip">
        {days.map((d) => {
          const planned = !!week[d.dow]
          const trained = trainedDays.has(d.key)
          return (
            <div key={d.key} className={`wday${d.key === todayKey ? ' today' : ''}`}>
              <span className="sub">{DAY_SHORT[d.dow]}</span>
              <b>{d.date.getDate()}</b>
              <span className={`dot${trained ? ' on' : planned ? ' plan' : ''}`} />
            </div>
          )
        })}
      </div>

      {active ? (
        <Link to="/workout" className="card tap row between hero">
          <div>
            <div className="sub">Devam eden antrenman</div>
            <div className="exname">{active.name}</div>
          </div>
          <span className="badge on">Devam et ▶</span>
        </Link>
      ) : todayRoutine ? (
        <div className="card row between hero">
          <div>
            <div className="sub">{doneToday ? 'Bugün tamamlandı ✓' : 'Bugünün antrenmanı'}</div>
            <div className="exname">{todayRoutine.name}</div>
            <div className="sub">{todayRoutine.ex.length} egzersiz</div>
          </div>
          <button
            className="btn primary"
            onClick={() => {
              startWorkout(todayRoutine.id)
              navigate('/workout')
            }}
          >
            {doneToday ? 'Tekrar' : 'Başla'}
          </button>
        </div>
      ) : (
        <div className="card row between hero">
          <div>
            <div className="exname">{routines.length === 0 ? 'Rutin oluştur' : 'Bugün dinlenme günü'}</div>
            <div className="sub">
              {routines.length === 0 ? 'İlk rutinini kur, günlere ata.' : 'İstersen yine de antrenman başlatabilirsin.'}
            </div>
          </div>
          <Link to={routines.length === 0 ? '/plan' : '/workout'} className="btn">
            {routines.length === 0 ? 'Plan' : 'Seç'}
          </Link>
        </div>
      )}

      <div className="grid3">
        <div className="card stat"><b>{streak}</b><span className="sub">hafta serisi</span></div>
        <div className="card stat"><b>{thisMonth}</b><span className="sub">bu ay</span></div>
        <div className="card stat"><b>{workouts.length}</b><span className="sub">toplam</span></div>
      </div>

      <div className="card stack">
        <div className="row between">
          <div>
            <div className="sub">Vücut ağırlığı</div>
            <b style={{ fontSize: 22 }}>{lastBw ? `${formatWeight(lastBw.w, unit)} ${unit}` : '—'}</b>
          </div>
          <button
            className="btn small"
            onClick={() => {
              setDraftW(lastBw?.w ?? 0)
              setLogging(true)
            }}
          >
            Kaydet
          </button>
        </div>
        {bodyweight.length > 1 && (
          <LineChart
            unit={unit}
            points={bodyweight.slice(-30).map((b) => ({ label: b.d.slice(5), value: Math.round(kgToUnit(b.w, unit) * 10) / 10 }))}
          />
        )}
        <BodyweightTrend compact />
      </div>

      <BottomSheet open={logging} onClose={() => setLogging(false)} title="Bugünkü tartı">
        <div className="stack">
          <NumberField
            value={draftW}
            toDisplay={(v) => kgToUnit(v, unit)}
            fromDisplay={(v) => unitToKg(v, unit)}
            step={0.1}
            label={`Ağırlık (${unit})`}
            onChange={setDraftW}
          />
          <button
            className="btn primary block"
            disabled={draftW <= 0}
            onClick={() => {
              logBodyweight({ d: todayKey, w: draftW })
              setLogging(false)
            }}
          >
            {unit} olarak kaydet
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
