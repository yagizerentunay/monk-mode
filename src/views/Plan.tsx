import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { DAY_NAMES } from '../lib/dates.ts'
import { newId } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

export function Plan() {
  const navigate = useNavigate()
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const weekStart = useStore((s) => s.settings.weekStart)
  const assignDay = useStore((s) => s.assignDay)
  const [tab, setTab] = useState<'week' | 'routines'>('week')
  const [dayPicker, setDayPicker] = useState<number | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7)
  const nameOf = (id?: string) => routines.find((r) => r.id === id)?.name

  return (
    <div className="stack">
      <h1>Plan</h1>
      <div className="chips">
        <button className={`chip${tab === 'week' ? ' on' : ''}`} onClick={() => setTab('week')}>Haftalık program</button>
        <button className={`chip${tab === 'routines' ? ' on' : ''}`} onClick={() => setTab('routines')}>Rutinler</button>
      </div>

      {tab === 'week' && (
        <div className="stack">
          {routines.length === 0 && (
            <p className="sub">Önce bir rutin oluştur, sonra günlere ata.</p>
          )}
          {days.map((d) => (
            <button key={d} className="card tap row between" onClick={() => setDayPicker(d)}>
              <span>{DAY_NAMES[d]}</span>
              <span className={nameOf(week[d]) ? '' : 'sub'}>{nameOf(week[d]) ?? 'Dinlenme'}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'routines' && (
        <div className="stack">
          {routines.map((r) => (
            <Link key={r.id} to={`/plan/r/${r.id}`} className="card tap row between">
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
