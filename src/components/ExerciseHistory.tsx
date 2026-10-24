import { t } from '../i18n/index.ts'
import { useMemo } from 'react'
import { formatAxisDay, formatShortDay } from '../lib/calendar.ts'
import { formatDistance, formatDistanceSet, formatLongClock } from '../lib/distance.ts'
import { exerciseSummary } from '../lib/exerciseStats.ts'
import { goalFor } from '../lib/goals.ts'
import { formatLoad, formatTimedLoad } from '../lib/load.ts'
import { formatSet } from '../lib/sets.ts'
import { formatDuration } from '../lib/timed.ts'
import { formatWeight, kgToUnit } from '../lib/units.ts'
import { exerciseHistory } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'
import { LineChart } from './LineChart.tsx'
import { PlateauNote } from './PlateauNote.tsx'

/** Kütüphane detayında: bu egzersizde kullanıcının kendi geçmişi (son seans, en iyi 1RM, ilerleme). */
export function ExerciseHistory({ exId }: { exId: string }) {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const goal = useStore((s) => goalFor(s.goals, exId))
  const summary = useMemo(() => exerciseSummary(workouts, exId), [workouts, exId])
  // Grafik son seansın türünü izler: süreliyse en uzun tutuş (sn), değilse tahmini 1RM; karışık geçmişte
  // diğer türün noktaları (1RM'siz süreli seans ya da saniyesi tekrar sanılacak seans) çizilmez. Mesafe
  // seansında grafik seansın toplam mesafesidir (km).
  const distanceKind = !!summary.last?.distance
  const timedKind = !distanceKind && !!summary.last?.timed
  const points = useMemo(
    () =>
      exerciseHistory(workouts, exId)
        .filter((p) => !!p.distance === distanceKind && !!p.timed === timedKind)
        .map((p) => ({
          label: formatAxisDay(p.d),
          value: distanceKind
            ? Math.round((p.totalM ?? 0) / 10) / 100
            : timedKind
              ? (p.topSec ?? 0)
              : Math.round(kgToUnit(p.e1rm, unit) * 10) / 10,
        })),
    [workouts, exId, unit, timedKind, distanceKind],
  )

  if (summary.sessions === 0 || !summary.last) {
    return (
      <div className="stack">
        <div className="eyebrow">{t('exHistory.title')}</div>
        <p className="sub" style={{ margin: 0 }}>{t('exHistory.empty')}</p>
      </div>
    )
  }

  const { last, best, bestHold, distance } = summary
  return (
    <div className="stack">
      <div className="eyebrow">{t('exHistory.title')} · {t('count.sessions', { n: summary.sessions })}</div>
      {best && (
        <div>
          <div className="row statbig">
            <span className="bignum">{formatWeight(best.e1rm, unit)}</span>
            <span className="statunit">{unit} · {t('exHistory.bestE1rm')}</span>
          </div>
          <div className="sub">{formatSet({ w: best.w, r: best.r, done: true }, formatLoad(best.bw, best.w, unit))} · {formatShortDay(best.d)}</div>
        </div>
      )}
      {bestHold && (
        <div>
          <div className="row statbig">
            <span className="bignum">{formatDuration(bestHold.sec)}</span>
            <span className="statunit">{t('stats.metric.longestHold')}</span>
          </div>
          <div className="sub">
            {formatSet({ w: bestHold.w, r: bestHold.sec, done: true }, formatTimedLoad(bestHold.bw, bestHold.w, unit), true)} · {formatShortDay(bestHold.d)}
          </div>
        </div>
      )}
      {distance && (
        <div>
          <div className="row statbig">
            <span className="bignum">{formatDistance(distance.totalM)}</span>
            <span className="statunit">{t('home.total')} · {formatLongClock(distance.totalSec)}</span>
          </div>
          {distance.longest && (
            <div className="sub">{t('records.longest')}: {formatDistanceSet({ m: distance.longest.m, r: distance.longest.sec })} · {formatShortDay(distance.longest.d)}</div>
          )}
          {distance.bestPace && (
            <div className="sub">
              {t('exHistory.bestPace', { pace: `${formatLongClock(distance.bestPace.pace)} /km`, distance: formatDistance(distance.bestPace.m) })} · {formatShortDay(distance.bestPace.d)}
            </div>
          )}
        </div>
      )}
      <div>
        <div className="eyebrow muted">{t('exHistory.lastSession')} · {formatShortDay(last.d)}</div>
        <div className="sub">
          {last.sets
            .map((s) =>
              last.distance
                ? formatDistanceSet(s)
                : last.timed
                ? formatSet(s, formatTimedLoad(last.bw, s.w, unit), true)
                : formatSet(s, formatLoad(last.bw, s.w, unit)),
            )
            .join(' · ')}
        </div>
      </div>
      <PlateauNote exId={exId} />
      {points.length >= 2 && (
        <LineChart
          points={points}
          unit={distanceKind ? 'km' : timedKind ? t('unit.sec') : unit}
          // Hedef tahmini 1RM'dir; süreli (saniye) ve mesafe (km) grafiğinde anlamı yok.
          target={goal && !timedKind && !distanceKind ? { value: Math.round(kgToUnit(goal.target, unit) * 10) / 10, label: t('workout.target', { set: `${formatWeight(goal.target, unit)} ${unit}` }) } : undefined}
        />
      )}
    </div>
  )
}
