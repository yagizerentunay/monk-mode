import { t } from '../i18n/index.ts'
import { useMemo, useState } from 'react'
import { BodyweightCard } from '../components/BodyweightCard.tsx'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { LineChart } from '../components/LineChart.tsx'
import { FrequencyCard } from '../components/FrequencyCard.tsx'
import { MeasurementsCard } from '../components/MeasurementsCard.tsx'
import { GoalsCard } from '../components/GoalsCard.tsx'
import { MuscleCard } from '../components/MuscleCard.tsx'
import { RecordsCard } from '../components/RecordsCard.tsx'
import { WeeklyTrendCard } from '../components/WeeklyTrendCard.tsx'
import { WorkoutDetail } from '../components/WorkoutDetail.tsx'
import { formatAxisDay, formatShortDay } from '../lib/calendar.ts'
import { formatLongClock } from '../lib/distance.ts'
import { goalFor } from '../lib/goals.ts'
import { formatDecimal, formatWeight, kgToUnit } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, exerciseHistory, hasVolume, workoutVolume } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

type Metric = 'e1rm' | 'topW'

/** 2,5 gibi: ondalık ayracı dile göre (Türkçede virgül). */
function fmtNum(n: number): string {
  return formatDecimal(n)
}

export function Stats() {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const goals = useStore((s) => s.goals)
  const { byId } = useExercises()
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [chosen, setChosen] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // Geçmişi olan egzersizler, en sık yapılandan başlayarak.
  const exIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of workouts) for (const e of w.entries) counts.set(e.exId, (counts.get(e.exId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [workouts])

  const selected = chosen && exIds.includes(chosen) ? chosen : exIds[0]
  const history = selected ? exerciseHistory(workouts, selected) : []
  // Grafik son seansın türünü izler (bkz. ExerciseHistory): süreliyse en uzun tutuş, saniye olarak; mesafe
  // egzersizinde seansın toplam mesafesi (km), son seansın en iyi temposu altta yazılır.
  const lastHist = history[history.length - 1]
  const distSel = !!lastHist?.distance
  const timedSel = !distSel && !!lastHist?.timed
  const points = history
    .filter((p) => !!p.distance === distSel && !!p.timed === timedSel)
    .map((p) => ({
      label: formatAxisDay(p.d),
      value: distSel
        ? Math.round((p.totalM ?? 0) / 10) / 100
        : timedSel
          ? (p.topSec ?? 0)
          : Math.round(kgToUnit(metric === 'e1rm' ? p.e1rm : p.topW, unit) * 10) / 10,
    }))
  // Hedef çizgisi yalnız tahmini 1RM grafiğinde: en ağır set başka bir ölçüdür.
  const goal = selected && !timedSel && !distSel && metric === 'e1rm' ? goalFor(goals, selected) : undefined
  const open = workouts.find((w) => w.id === openId) ?? null
  const recent = [...workouts].reverse().slice(0, 30)

  const metricLabel = distSel
    ? t('stats.metric.distance')
    : timedSel
      ? t('stats.metric.longestHold')
      : metric === 'e1rm'
        ? t('stats.metric.e1rm')
        : t('stats.metric.topSet')
  const valueUnit = distSel ? 'km' : timedSel ? t('unit.sec') : unit
  const lastPt = points[points.length - 1]
  const prevPt = points.length >= 2 ? points[points.length - 2] : null
  // Değişim yalnız iki seans varsa hesaplanır; veri yoksa uydurulmaz.
  const delta = lastPt && prevPt ? Math.round((lastPt.value - prevPt.value) * 10) / 10 : null

  return (
    <div className="stack statsview">
      <header>
        <div className="eyebrow">{t('stats.eyebrow')}</div>
        <h1 className="display">{t('stats.titleA')}<span className="hl">{t('stats.titleB')}</span></h1>
      </header>

      <div className="card stack">
        <div>
          <div className="eyebrow">{t('stats.strength')}</div>
          <h2 style={{ margin: 0 }}>{t('stats.progress')}</h2>
        </div>
        {exIds.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>{t('stats.empty')}</p>
        ) : (
          <>
            <select className="input" value={selected} onChange={(e) => setChosen(e.target.value)} aria-label={t('stats.exerciseAria')}>
              {exIds.map((id) => (
                <option key={id} value={id}>{byId.get(id)?.name ?? id}</option>
              ))}
            </select>
            {lastPt && (
              <div>
                <div className="row statbig">
                  <span className="bignum">{fmtNum(lastPt.value)}</span>
                  <span className="statunit">{valueUnit} · {metricLabel}</span>
                </div>
                {distSel && lastHist?.pace !== undefined && (
                  <div className="sub">{t('stats.lastPace', { pace: `${formatLongClock(lastHist.pace)} /km` })}</div>
                )}
                {delta === null ? (
                  <div className="sub">{t('stats.needAnother')}</div>
                ) : (
                  <div className={`statdelta${delta > 0 ? ' up' : ''}`}>
                    {delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '= '}{fmtNum(delta)} {valueUnit} · {t('stats.vsPrevious')}
                  </div>
                )}
              </div>
            )}
            <LineChart
              points={points}
              unit={valueUnit}
              target={goal ? { value: Math.round(kgToUnit(goal.target, unit) * 10) / 10, label: t('workout.target', { set: `${formatWeight(goal.target, unit)} ${unit}` }) } : undefined}
            />
            {!timedSel && !distSel && (
              <div className="chips statseg" role="group" aria-label={t('stats.metricAria')}>
                <button className={`chip${metric === 'e1rm' ? ' on' : ''}`} aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>{t('stats.e1rmChip')}</button>
                <button className={`chip${metric === 'topW' ? ' on' : ''}`} aria-pressed={metric === 'topW'} onClick={() => setMetric('topW')}>{t('stats.topSetChip')}</button>
              </div>
            )}
          </>
        )}
      </div>

      <GoalsCard />

      <RecordsCard />

      <WeeklyTrendCard />

      <FrequencyCard />

      <BodyweightCard />

      <MeasurementsCard />

      <MuscleCard />

      <div className="card stack">
        <div>
          <div className="eyebrow">{t('stats.history')}</div>
          <h2 style={{ margin: 0 }}>{t('stats.recent')}</h2>
        </div>
        {recent.length === 0 && <p className="sub" style={{ margin: 0 }}>{t('stats.noWorkouts')}</p>}
        {recent.map((w) => (
          <button key={w.id} className="exrow" onClick={() => setOpenId(w.id)}>
            <div className="grow">
              <div className="exname">{w.name}</div>
              <div className="sub">{formatShortDay(w.d)} · {t('count.sets', { n: doneSetCount(w).done })}</div>
            </div>
            {hasVolume(w) && <span className="sub">{formatWeight(workoutVolume(w), unit)} {unit}</span>}
          </button>
        ))}
      </div>

      <BottomSheet open={!!open} onClose={() => setOpenId(null)} title={open?.name}>
        {open && <WorkoutDetail workout={open} onClose={() => setOpenId(null)} />}
      </BottomSheet>
    </div>
  )
}
