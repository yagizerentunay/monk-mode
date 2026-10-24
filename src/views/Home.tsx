import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { BackupReminder } from '../components/BackupReminder.tsx'
import { BlockStrip } from '../components/BlockStrip.tsx'
import { BodyweightTrend } from '../components/BodyweightTrend.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { CalendarSheet } from '../components/CalendarSheet.tsx'
import { DeloadHint } from '../components/DeloadHint.tsx'
import { HomeScreenHint } from '../components/HomeScreenHint.tsx'
import { Wordmark } from '../components/Brand.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { locale, t } from '../i18n/index.ts'
import { formatAxisDay } from '../lib/calendar.ts'
import { DAY_NAMES, DAY_SHORT } from '../lib/dates.ts'
import { suggestNextRoutine } from '../lib/nextWorkout.ts'
import { weekStartOf, weekStreak } from '../lib/streak.ts'
import { formatWeight, kgToUnit, unitToKg } from '../lib/units.ts'
import { dayString } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

export function Home() {
  const navigate = useNavigate()
  // Yalnız kullanılan alanlar: başka bir alan (ör. özel egzersiz, kas düzeltmesi) değişince Home yeniden çizilmez.
  const { routines, week, workouts, active, bodyweight } = useStore(
    useShallow((s) => ({ routines: s.routines, week: s.week, workouts: s.workouts, active: s.active, bodyweight: s.bodyweight })),
  )
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
  // Tüm geçmişi tarayan hesaplar yalnız veri değişince; kilo yazarken ya da takvim açılırken tekrarlanmaz.
  const trainedDays = useMemo(() => new Set(workouts.map((w) => w.d)), [workouts])

  const todayRoutine = routines.find((r) => r.id === week[today.getDay()])
  const doneToday = trainedDays.has(todayKey)
  // Sıradaki öneri yalnız dinlenme gününde ya da bugünün planı bittiğinde; bugünün rutiniyle aynıysa gereksiz.
  const suggestion = useMemo(() => suggestNextRoutine(routines, workouts), [routines, workouts])
  const next = suggestion && (!todayRoutine || (doneToday && suggestion.routine.id !== todayRoutine.id)) ? suggestion : undefined
  const nextBlock = next && (
    <div className="hero-next stack">
      <div className="eyebrow">{t('home.next')}</div>
      <div className="hero-next-title">{next.routine.name}</div>
      <div className="sub">
        {next.last ? `${t('home.last', { name: next.last.name })} · ` : ''}{t('count.exercises', { n: next.routine.ex.length })}
      </div>
      <button
        className="btn primary block"
        onClick={() => {
          startWorkout(next.routine.id)
          navigate('/workout')
        }}
      >
        {t('home.start')} ▶
      </button>
    </div>
  )
  const streak = useMemo(() => weekStreak(workouts, today, weekStart), [workouts, today, weekStart])
  const monthPrefix = todayKey.slice(0, 7)
  const thisMonth = useMemo(() => workouts.filter((w) => w.d.startsWith(monthPrefix)).length, [workouts, monthPrefix])
  const lastBw = bodyweight[bodyweight.length - 1]

  const workSets = todayRoutine ? todayRoutine.ex.reduce((n, e) => n + e.sets, 0) : 0
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateLine = `${DAY_NAMES[today.getDay()]} · ${today.toLocaleDateString(locale(), { day: '2-digit', month: 'long' })}`

  return (
    <div className="stack home">
      <header className="home-top">
        <h1 className="sr-only">monk-mode</h1>
        <Wordmark seal />
        <div className="row">
          <button className="btn icon" aria-label={t('home.calendar')} onClick={() => setCalendar({ date: null })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10h16M9 3v4M15 3v4" />
            </svg>
          </button>
          <Link to="/settings" className="btn icon" aria-label={t('settings.title')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
              <circle cx="16" cy="7" r="2.5" />
              <circle cx="8" cy="17" r="2.5" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="home-head">
        <div className="eyebrow">{dateLine}</div>
        <p className="display">{t('home.heroA')}<span className="hl">{t('home.heroB')}</span></p>
        <div className="sub">{t('home.motto')}</div>
      </div>

      <BackupReminder />
      <HomeScreenHint />
      <BlockStrip />
      <DeloadHint />

      <div className="weekstrip">
        {days.map((d) => {
          const planned = !!week[d.dow]
          const trained = trainedDays.has(d.key)
          return (
            <button
              key={d.key}
              className={`wday${d.key === todayKey ? ' today' : ''}${trained ? ' done' : ''}`}
              aria-label={t('home.dayAria', {
                day: `${DAY_NAMES[d.dow]} ${d.date.getDate()}`,
                state: trained ? t('home.dayTrained') : planned ? t('home.dayPlanned') : '',
              })}
              onClick={() => setCalendar({ date: d.key })}
            >
              <span className="sub">{DAY_SHORT[d.dow]}</span>
              <b>{d.date.getDate()}</b>
              <span className={`dot${trained ? ' on' : planned ? ' plan' : ''}`} />
              <span className="wlabel" aria-hidden="true">{trained ? t('home.done') : planned ? t('home.plan') : ' '}</span>
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
          <div className="eyebrow">{t('home.activeWorkout')}</div>
          <div className="hero-title">{active.name}</div>
          <Link to="/workout" className="btn primary block">{t('home.continue')} ▶</Link>
        </div>
      ) : todayRoutine ? (
        <div className="card hero stack">
          <div className={doneToday ? 'eyebrow ok' : 'eyebrow'}>{doneToday ? `✓ ${t('home.doneToday')}` : t('home.todaysWorkout')}</div>
          <div className="hero-title">{todayRoutine.name}</div>
          <div className="sub">{t('count.exercises', { n: todayRoutine.ex.length })} · {t('home.workSets', { n: workSets })}</div>
          <button
            className={nextBlock ? 'btn block' : 'btn primary block'}
            onClick={() => {
              startWorkout(todayRoutine.id)
              navigate('/workout')
            }}
          >
            {doneToday ? t('home.startAgain') : t('home.startWorkout')}
          </button>
          {nextBlock}
        </div>
      ) : (
        <div className="card hero stack">
          <div className="eyebrow muted">{routines.length === 0 ? t('home.noRoutine') : t('home.restDay')}</div>
          <div className="hero-title">{routines.length === 0 ? t('home.createRoutine') : t('home.recover')}</div>
          <div className="sub">
            {routines.length === 0 ? t('home.createRoutineHint') : t('home.restDayHint')}
          </div>
          {nextBlock}
          <Link to={routines.length === 0 ? '/plan' : '/workout'} className={nextBlock ? 'btn block' : 'btn primary block'}>
            {routines.length === 0 ? t('home.createPlan') : t('home.pickWorkout')}
          </Link>
        </div>
      )}

      <div className="grid3">
        <div className="card stat"><span className="bignum">{pad(streak)}</span><span className="statlbl">{t('home.weekStreak')}</span></div>
        <div className="card stat"><span className="bignum">{pad(thisMonth)}</span><span className="statlbl">{t('home.thisMonth')}</span></div>
        <div className="card stat"><span className="bignum">{pad(workouts.length)}</span><span className="statlbl">{t('home.total')}</span></div>
      </div>

      <div className="card stack">
        <div className="row between">
          <div>
            <div className="eyebrow muted">{t('home.bodyweight')}</div>
            <span className="bignum bw">{lastBw ? `${formatWeight(lastBw.w, unit)} ${unit}` : '—'}</span>
          </div>
          <button
            className="btn small"
            onClick={() => {
              setDraftW(lastBw?.w ?? 0)
              setLogging(true)
            }}
          >
            {t('home.log')}
          </button>
        </div>
        {bodyweight.length > 1 && (
          <LineChart
            unit={unit}
            points={bodyweight.slice(-30).map((b) => ({ label: formatAxisDay(b.d), value: Math.round(kgToUnit(b.w, unit) * 10) / 10 }))}
          />
        )}
        <BodyweightTrend compact />
      </div>

      <BottomSheet open={logging} onClose={() => setLogging(false)} title={t('home.todaysWeighIn')}>
        <div className="stack">
          <NumberField
            value={draftW}
            toDisplay={(v) => kgToUnit(v, unit)}
            fromDisplay={(v) => unitToKg(v, unit)}
            step={0.1}
            label={t('home.weightUnit', { unit })}
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
            {t('home.saveAs', { unit })}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
