import { useMemo } from 'react'
import { formatAxisDay, formatShortDay } from '../lib/calendar.ts'
import { exerciseSummary } from '../lib/exerciseStats.ts'
import { formatLoad } from '../lib/load.ts'
import { formatSet } from '../lib/sets.ts'
import { formatWeight, kgToUnit } from '../lib/units.ts'
import { exerciseHistory } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'
import { LineChart } from './LineChart.tsx'
import { PlateauNote } from './PlateauNote.tsx'

/** Kütüphane detayında: bu egzersizde kullanıcının kendi geçmişi (son seans, en iyi 1RM, ilerleme). */
export function ExerciseHistory({ exId }: { exId: string }) {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const summary = useMemo(() => exerciseSummary(workouts, exId), [workouts, exId])
  const points = useMemo(
    () =>
      exerciseHistory(workouts, exId).map((p) => ({
        label: formatAxisDay(p.d),
        value: Math.round(kgToUnit(p.e1rm, unit) * 10) / 10,
      })),
    [workouts, exId, unit],
  )

  if (summary.sessions === 0 || !summary.last) {
    return (
      <div className="stack">
        <div className="eyebrow">Senin geçmişin</div>
        <p className="sub" style={{ margin: 0 }}>Bu egzersizi henüz kaydetmedin. İlk seanstan sonra son performansın ve rekorun burada görünür.</p>
      </div>
    )
  }

  const { last, best } = summary
  return (
    <div className="stack">
      <div className="eyebrow">Senin geçmişin · {summary.sessions} seans</div>
      {best && (
        <div>
          <div className="row statbig">
            <span className="bignum">{formatWeight(best.e1rm, unit)}</span>
            <span className="statunit">{unit} · en iyi tahmini 1RM</span>
          </div>
          <div className="sub">{formatSet({ w: best.w, r: best.r, done: true }, formatLoad(best.bw, best.w, unit))} · {formatShortDay(best.d)}</div>
        </div>
      )}
      <div>
        <div className="eyebrow muted">Son seans · {formatShortDay(last.d)}</div>
        <div className="sub">{last.sets.map((s) => formatSet(s, formatLoad(last.bw, s.w, unit))).join(' · ')}</div>
      </div>
      <PlateauNote exId={exId} />
      {points.length >= 2 && <LineChart points={points} unit={unit} />}
    </div>
  )
}
