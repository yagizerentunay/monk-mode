import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { DAY_NAMES, DAY_SHORT } from '../lib/dates.ts'
import { weekStartOf } from '../lib/streak.ts'
import { dayString, newId } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

export function Plan() {
  const navigate = useNavigate()
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const workouts = useStore((s) => s.workouts)
  const weekStart = useStore((s) => s.settings.weekStart)
  const assignDay = useStore((s) => s.assignDay)
  const [tab, setTab] = useState<'week' | 'routines'>('week')
  const [dayPicker, setDayPicker] = useState<number | null>(null)
  const [today] = useState(() => new Date())

  const todayKey = dayString(today)
  const monday = weekStartOf(today, weekStart)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    return { dow: date.getDay(), no: date.getDate(), key: dayString(date) }
  })
  const trainedDays = new Set(workouts.map((w) => w.d))
  const plannedCount = days.filter((d) => week[d.dow]).length
  const weekLabel = `${monday.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })} haftası`
  const nameOf = (id?: string) => routines.find((r) => r.id === id)?.name

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Haftalık plan</div>
        <h1 className="display">Bir plan.<span className="hl">Her gün.</span></h1>
      </div>
      <div className="seg" role="tablist" aria-label="Plan görünümü">
        <button role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'on' : ''} onClick={() => setTab('week')}>Haftalık program</button>
        <button role="tab" aria-selected={tab === 'routines'} className={tab === 'routines' ? 'on' : ''} onClick={() => setTab('routines')}>Rutinler</button>
      </div>

      {tab === 'week' && (
        <div className="stack">
          <div className="eyebrow muted">{weekLabel} · {plannedCount} planlı gün</div>
          {routines.length === 0 && (
            <p className="sub">Önce bir rutin oluştur, sonra günlere ata.</p>
          )}
          {days.map((d) => {
            const name = nameOf(week[d.dow])
            const done = trainedDays.has(d.key)
            const isToday = d.key === todayKey
            return (
              <button
                key={d.dow}
                className={`card tap dayrow${isToday ? ' today' : ''}${name ? '' : ' dayrest'}`}
                aria-label={DAY_NAMES[d.dow]}
                onClick={() => setDayPicker(d.dow)}
              >
                <span className="daydate">
                  <span className="dow">{DAY_SHORT[d.dow]}</span>
                  <span className="dno">{String(d.no).padStart(2, '0')}</span>
                </span>
                <span className="grow">
                  <span className="dayname">{name ?? 'Dinlenme'}</span>
                  <span className="daysub">{name ? 'Planlı antrenman' : 'Toparlanma günü'}{isToday ? ' · Bugün' : ''}</span>
                </span>
                {done && <span className="donemark">✓ Yapıldı</span>}
                <span className="chev" aria-hidden="true">›</span>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'routines' && (
        <div className="stack">
          <div className="eyebrow muted">{routines.length} rutin</div>
          {routines.map((r) => (
            <Link key={r.id} to={`/plan/r/${r.id}`} className="card tap row between routinecard">
              <div>
                <div className="exname">{r.name}</div>
                <div className="sub">{r.ex.length} egzersiz</div>
              </div>
              <span className="sub">Düzenle ›</span>
            </Link>
          ))}
          <button className="btn primary block" onClick={() => navigate(`/plan/r/${newId()}`)}>+ Yeni rutin</button>
        </div>
      )}

      <BottomSheet
        open={dayPicker !== null}
        onClose={() => setDayPicker(null)}
        title={dayPicker !== null ? DAY_NAMES[dayPicker] : ''}
      >
        <div className="stack">
          {routines.map((r) => (
            <button
              key={r.id}
              className={`btn block${dayPicker !== null && week[dayPicker] === r.id ? ' primary' : ''}`}
              onClick={() => {
                if (dayPicker !== null) assignDay(dayPicker, r.id)
                setDayPicker(null)
              }}
            >
              {r.name}
            </button>
          ))}
          <button
            className="btn block"
            onClick={() => {
              if (dayPicker !== null) assignDay(dayPicker, null)
              setDayPicker(null)
            }}
          >
            Dinlenme günü
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
