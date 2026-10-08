import { useMemo, useState } from 'react'
import { draftForDate } from '../lib/backdate.ts'
import { formatDayTitle, MONTH_NAMES, monthGrid, parseDay, shiftMonth, weekdayOrder } from '../lib/calendar.ts'
import { DAY_SHORT } from '../lib/dates.ts'
import { formatWeight } from '../lib/units.ts'
import { dayString, doneSetCount, workoutVolume } from '../lib/workout.ts'
import type { Routine, Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { BottomSheet } from './BottomSheet.tsx'
import { WorkoutDetail } from './WorkoutDetail.tsx'
import { WorkoutEditor } from './WorkoutEditor.tsx'

type View =
  | { kind: 'cal' }
  | { kind: 'day'; date: string }
  | { kind: 'detail'; date: string; id: string }
  | { kind: 'pick'; date: string }
  | { kind: 'record'; date: string; routineId: string }

interface Props {
  open: boolean
  onClose: () => void
  /** Verilirse sheet doğrudan o günün görünümüyle açılır; yoksa aylık takvimle. */
  initialDate?: string | null
}

/** Her açılışta temiz durumla başlaması için durum iç bileşende tutulur. */
export function CalendarSheet({ open, onClose, initialDate }: Props) {
  if (!open) return null
  return <CalendarSheetInner onClose={onClose} initialDate={initialDate ?? null} />
}

function CalendarSheetInner({ onClose, initialDate }: { onClose: () => void; initialDate: string | null }) {
  const workouts = useStore((s) => s.workouts)
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const weekStart = useStore((s) => s.settings.weekStart)
  const addWorkout = useStore((s) => s.addWorkout)

  const [today] = useState(() => dayString())
  const [view, setView] = useState<View>(initialDate ? { kind: 'day', date: initialDate } : { kind: 'cal' })
  const [cursor, setCursor] = useState(() => {
    const d = parseDay(initialDate ?? today)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const trained = useMemo(() => new Set(workouts.map((w) => w.d)), [workouts])
  const plannedOn = (date: string): Routine | undefined => routines.find((r) => r.id === week[parseDay(date).getDay()])
  const goDay = (date: string) => setView({ kind: 'day', date })

  const detailWorkout = view.kind === 'detail' ? workouts.find((w) => w.id === view.id) : undefined
  // Detay görünümündeki antrenman silindiyse güne dön.
  const effective: View = view.kind === 'detail' && !detailWorkout ? { kind: 'day', date: view.date } : view

  const title =
    effective.kind === 'cal'
      ? 'Takvim'
      : effective.kind === 'pick'
        ? 'Rutin seç'
        : effective.kind === 'record'
          ? 'Antrenman kaydet'
          : formatDayTitle(effective.date)

  return (
    <BottomSheet open onClose={onClose} title={title}>
      <div className="stack">
        {effective.kind === 'day' && <button className="btn small" onClick={() => setView({ kind: 'cal' })}>‹ Takvim</button>}
        {(effective.kind === 'detail' || effective.kind === 'pick') && (
          <button className="btn small" onClick={() => goDay(effective.date)}>‹ {formatDayTitle(effective.date)}</button>
        )}
        {effective.kind === 'record' && (
          <button className="btn small" onClick={() => setView({ kind: 'pick', date: effective.date })}>‹ Rutin seç</button>
        )}

        {effective.kind === 'cal' && (
          <MonthView
            cursor={cursor}
            setCursor={setCursor}
            weekStart={weekStart}
            today={today}
            trained={trained}
            planned={(d) => !!plannedOn(d)}
            onPick={goDay}
          />
        )}

        {effective.kind === 'day' && (
          <DayView
            date={effective.date}
            today={today}
            workouts={workouts.filter((w) => w.d === effective.date)}
            planned={plannedOn(effective.date)}
            hasRoutines={routines.length > 0}
            onOpen={(id) => setView({ kind: 'detail', date: effective.date, id })}
            onRecord={() => setView({ kind: 'pick', date: effective.date })}
          />
        )}

        {effective.kind === 'detail' && detailWorkout && (
          <WorkoutDetail workout={detailWorkout} onClose={() => goDay(effective.date)} hideDate />
        )}

        {effective.kind === 'pick' && (
          <div className="stack">
            {[...routines]
              .sort((a, b) => Number(b.id === plannedOn(effective.date)?.id) - Number(a.id === plannedOn(effective.date)?.id))
              .map((r) => (
                <button
                  key={r.id}
                  className="card tap row between"
                  onClick={() => setView({ kind: 'record', date: effective.date, routineId: r.id })}
                >
                  <div>
                    <div className="exname">{r.name}</div>
                    <div className="sub">{r.ex.length} egzersiz</div>
                  </div>
                  {r.id === plannedOn(effective.date)?.id && <span className="badge on">planlı</span>}
                </button>
              ))}
          </div>
        )}

        {effective.kind === 'record' && (
          <RecordView
            date={effective.date}
            routine={routines.find((r) => r.id === effective.routineId)}
            workouts={workouts}
            onSave={(w) => {
              addWorkout(w)
              goDay(effective.date)
            }}
            onCancel={() => setView({ kind: 'pick', date: effective.date })}
          />
        )}
      </div>
    </BottomSheet>
  )
}

interface MonthProps {
  cursor: { year: number; month: number }
  setCursor: (fn: (c: { year: number; month: number }) => { year: number; month: number }) => void
  weekStart: number
  today: string
  trained: ReadonlySet<string>
  planned: (date: string) => boolean
  onPick: (date: string) => void
}

function MonthView({ cursor, setCursor, weekStart, today, trained, planned, onPick }: MonthProps) {
  return (
    <>
      <div className="row between">
        <button className="btn small" aria-label="Önceki ay" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}>‹</button>
        <b className="calmonth">{MONTH_NAMES[cursor.month]} {cursor.year}</b>
        <button className="btn small" aria-label="Sonraki ay" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}>›</button>
      </div>
      <div className="calgrid calhead">
        {weekdayOrder(weekStart).map((d) => <span key={d} className="sub">{DAY_SHORT[d]}</span>)}
      </div>
      <div className="calgrid">
        {monthGrid(cursor.year, cursor.month, weekStart).flat().map((cell) => {
          const done = trained.has(cell.date)
          const plan = !done && planned(cell.date)
          return (
            <button
              key={cell.date}
              className={`calcell${cell.inMonth ? '' : ' out'}${cell.date === today ? ' today' : ''}`}
              aria-label={`${formatDayTitle(cell.date)}${done ? ', antrenman yapıldı' : plan ? ', planlı' : ''}`}
              onClick={() => onPick(cell.date)}
            >
              <span>{cell.day}</span>
              <span className={`dot${done ? ' on' : plan ? ' plan' : ''}`} />
            </button>
          )
        })}
      </div>
      <div className="sub">Yeşil nokta: antrenman yapıldı · gri nokta: planlı. Bir güne dokun.</div>
      <button
        className="btn small"
        onClick={() => {
          const d = parseDay(today)
          setCursor(() => ({ year: d.getFullYear(), month: d.getMonth() }))
        }}
      >
        Bugün
      </button>
    </>
  )
}

interface DayProps {
  date: string
  today: string
  workouts: Workout[]
  planned: Routine | undefined
  hasRoutines: boolean
  onOpen: (id: string) => void
  onRecord: () => void
}

/** Günün antrenmanları, planı ve (bugüne kadar) geçmişe antrenman girişi. */
function DayView({ date, today, workouts, planned, hasRoutines, onOpen, onRecord }: DayProps) {
  const unit = useStore((s) => s.settings.unit)
  const future = date > today
  return (
    <>
      {workouts.map((w) => (
        <button key={w.id} className="card tap row between" onClick={() => onOpen(w.id)}>
          <div>
            <div className="exname">{w.name}</div>
            <div className="sub">
              {doneSetCount(w).done} set · {formatWeight(workoutVolume(w), unit)} {unit}
            </div>
          </div>
          <span className="badge ok">Aç ▶</span>
        </button>
      ))}
      {workouts.length === 0 && (
        <p className="sub" style={{ margin: 0 }}>
          {future ? 'Gelecek bir gün.' : 'Bu günde kayıtlı antrenman yok.'}
          {planned ? ` Planlanan: ${planned.name} (${planned.ex.length} egzersiz).` : ' Bu gün için plan yok.'}
        </p>
      )}
      {future ? (
        <p className="sub" style={{ margin: 0 }}>Antrenman kaydı yalnız bugüne kadar girilebilir.</p>
      ) : (
        <>
          <button className="btn primary block" disabled={!hasRoutines} onClick={onRecord}>
            {workouts.length > 0 ? 'Bu tarihe bir antrenman daha kaydet' : 'Bu tarihe antrenman kaydet'}
          </button>
          {!hasRoutines && <p className="sub" style={{ margin: 0 }}>Kaydetmek için önce Plan'dan bir rutin oluştur.</p>}
        </>
      )}
    </>
  )
}

interface RecordProps {
  date: string
  routine: Routine | undefined
  workouts: Workout[]
  onSave: (w: Workout) => void
  onCancel: () => void
}

/** Rutinden o güne ait taslağı kurar; tüm setler "yapıldı" gelir, kullanıcı gerçek değerleri düzeltir. */
function RecordView({ date, routine, workouts, onSave, onCancel }: RecordProps) {
  // Taslak yalnız rutin/tarih değişince kurulur; düzenleyici kendi taslağını tutar.
  const draft = useMemo(() => (routine ? draftForDate(routine, workouts, date) : null), [routine, date]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!draft) return <p className="sub">Rutin bulunamadı.</p>
  return (
    <>
      <p className="sub" style={{ margin: 0 }}>
        Setler önerilen değerlerle "yapıldı" olarak geldi. Gerçekte yaptığına göre düzelt, yapmadığın seti ya da egzersizi sil.
      </p>
      <WorkoutEditor workout={draft} onSave={onSave} onCancel={onCancel} />
    </>
  )
}
