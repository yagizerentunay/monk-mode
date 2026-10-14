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
        <div className="eyebrow">Son {HEATMAP_WEEKS} hafta</div>
        <h2 style={{ margin: 0 }}>Antrenman sıklığı</h2>
        <div className="sub">Bu ay {thisMonth} antrenman · geçen ay {lastMonth}</div>
      </div>
      <FrequencyHeatmap grid={grid} weekStart={weekStart} />
    </div>
  )
}
