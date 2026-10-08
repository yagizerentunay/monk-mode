import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackupReminder } from '../components/BackupReminder.tsx'
import { BodyweightTrend } from '../components/BodyweightTrend.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { CalendarSheet } from '../components/CalendarSheet.tsx'
import { Wordmark } from '../components/Brand.tsx'
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
  /** Takvim sheet'i: null = kapalı; date verilirse o günün görünümüyle, null ise aylık takvimle açılır. */
  const [calendar, setCalendar] = useState<{ date: string | null } | null>(null)

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

  const workSets = todayRoutine ? todayRoutine.ex.reduce((n, e) => n + e.sets, 0) : 0
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateLine = `${DAY_NAMES[today.getDay()]} · ${today.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })}`

  return (
    <div className="stack home">
      <header className="home-top">
        <h1 className="sr-only">monk-mode</h1>
        <Wordmark seal />
        <div className="row">
          <button className="btn icon" aria-label="Takvim" onClick={() => setCalendar({ date: null })}>📅</button>
          <Link to="/settings" className="btn icon" aria-label="Ayarlar">⚙</Link>
        </div>
      </header>

      <div className="home-head">
        <div className="eyebrow">{dateLine}</div>
        <p className="display">BUGÜN<span className="hl">GÜÇLEN.</span></p>
        <div className="sub">Disiplin, tekrarlarla inşa edilir.</div>
      </div>

      <BackupReminder />

      <div className="weekstrip">
        {days.map((d) => {
          const planned = !!week[d.dow]
          const trained = trainedDays.has(d.key)
          return (
            <button
              key={d.key}
              className={`wday${d.key === todayKey ? ' today' : ''}${trained ? ' done' : ''}`}
              aria-label={`${DAY_NAMES[d.dow]} ${d.date.getDate()}${trained ? ', antrenman yapıldı' : planned ? ', planlı' : ''}, gün detayını aç`}
              onClick={() => setCalendar({ date: d.key })}
            >
              <span className="sub">{DAY_SHORT[d.dow]}</span>
              <b>{d.date.getDate()}</b>
              <span className={`dot${trained ? ' on' : planned ? ' plan' : ''}`} />
              <span className="wlabel" aria-hidden="true">{trained ? 'Yapıldı' : planned ? 'Plan' : ' '}</span>
            </button>
          )
        })}
      </div>

      <CalendarSheet
        open={calendar !== null}
        initialDate={calendar?.date ?? null}
        onClose={() => setCalendar(null)}
      />

      {active ? (
        <div className="card hero stack">
          <div className="eyebrow">Devam eden antrenman</div>
          <div className="hero-title">{active.name}</div>
          <Link to="/workout" className="btn primary block">Devam et ▶</Link>
        </div>
      ) : todayRoutine ? (
        <div className="card hero stack">
          <div className={doneToday ? 'eyebrow ok' : 'eyebrow'}>{doneToday ? '✓ Bugün tamamlandı' : 'Bugünün antrenmanı'}</div>
          <div className="hero-title">{todayRoutine.name}</div>
          <div className="sub">{todayRoutine.ex.length} egzersiz · {workSets} çalışma seti</div>
          <button
            className="btn primary block"
            onClick={() => {
              startWorkout(todayRoutine.id)
              navigate('/workout')
            }}
          >
            {doneToday ? 'Tekrar başla' : 'Antrenmana başla'}
          </button>
        </div>
      ) : (
        <div className="card hero stack">
          <div className="eyebrow muted">{routines.length === 0 ? 'Rutin yok' : 'Dinlenme günü'}</div>
          <div className="hero-title">{routines.length === 0 ? 'Rutin oluştur' : 'Bugün toparlan'}</div>
          <div className="sub">
            {routines.length === 0 ? 'İlk rutinini kur, günlere ata.' : 'İstersen yine de antrenman başlatabilirsin.'}
          </div>
          <Link to={routines.length === 0 ? '/plan' : '/workout'} className="btn primary block">
            {routines.length === 0 ? 'Plan oluştur' : 'Antrenman seç'}
          </Link>
        </div>
      )}

      <div className="grid3">
        <div className="card stat"><span className="bignum">{pad(streak)}</span><span className="statlbl">hafta serisi</span></div>
        <div className="card stat"><span className="bignum">{pad(thisMonth)}</span><span className="statlbl">bu ay</span></div>
        <div className="card stat"><span className="bignum">{pad(workouts.length)}</span><span className="statlbl">toplam</span></div>
      </div>

      <div className="card stack">
        <div className="row between">
          <div>
            <div className="eyebrow muted">Vücut ağırlığı</div>
            <span className="bignum bw">{lastBw ? `${formatWeight(lastBw.w, unit)} ${unit}` : '—'}</span>
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
