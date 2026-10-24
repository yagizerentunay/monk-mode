import { t } from '../i18n/index.ts'
import { useMemo, useState } from 'react'
import { heatmapGrid, HEATMAP_WEEKS, monthSummary } from '../lib/frequency.ts'
import { useStore } from '../store/useStore.ts'
import { FrequencyHeatmap } from './FrequencyHeatmap.tsx'

/** Analiz'de son 16 haftanın gün gün antrenman sıklığı ve ay özeti. */
export function FrequencyCard() {
  const workouts = useStore((s) => s.workouts)
  const weekStart = useStore((s) => s.settings.weekStart)
  const [today] = useState(() => new Date())

  const grid = useMemo(() => heatmapGrid(workouts, today, weekStart), [workouts, today, weekStart])
  const { thisMonth, lastMonth } = useMemo(() => monthSummary(workouts, today), [workouts, today])
  if (workouts.length === 0) return null

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">{t('stats.lastWeeks', { weeks: t('count.weeks', { n: HEATMAP_WEEKS }) })}</div>
        <h2 style={{ margin: 0 }}>{t('freq.title')}</h2>
        <div className="sub">{t('freq.months', { thisMonth: t('count.workouts', { n: thisMonth }), lastMonth })}</div>
      </div>
      <FrequencyHeatmap grid={grid} weekStart={weekStart} />
    </div>
  )
}
