import { useMemo, useState } from 'react'
import { formatAxisDay } from '../lib/calendar.ts'
import { formatWeight, kgToUnit } from '../lib/units.ts'
import { weekComparison, weeklyTotals, TREND_WEEKS } from '../lib/weeklyTrend.ts'
import { useStore } from '../store/useStore.ts'

type Metric = 'sets' | 'volume'

const W = 320
const H = 140
const PAD = { l: 8, r: 8, t: 14, b: 22 }

/** Analiz'de son 12 haftanın set ya da hacim toplamı; bu hafta bakır, diğerleri soluk. */
export function WeeklyTrendCard() {
  const workouts = useStore((s) => s.workouts)
  const weekStart = useStore((s) => s.settings.weekStart)
  const unit = useStore((s) => s.settings.unit)
  const [metric, setMetric] = useState<Metric>('sets')
  const [today] = useState(() => new Date())

  const totals = useMemo(() => weeklyTotals(workouts, today, weekStart), [workouts, today, weekStart])
  if (totals.every((w) => w.workouts === 0)) return null

  const value = (kg: number) => (metric === 'sets' ? kg : kgToUnit(kg, unit))
  const fmt = (v: number) => (metric === 'sets' ? String(Math.round(v)) : formatWeight(v, unit))
  const suffix = metric === 'sets' ? 'set' : unit
  const { current, average } = weekComparison(totals, metric)
  const max = Math.max(1, ...totals.map((w) => value(w[metric])))
  const slot = (W - PAD.l - PAD.r) / totals.length
  const barW = Math.max(4, slot * 0.62)
  const plotH = H - PAD.t - PAD.b

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Son {TREND_WEEKS} hafta</div>
        <h2 style={{ margin: 0 }}>Haftalık toplam</h2>
      </div>
      <div>
        <div className="row statbig">
          <span className="bignum">{fmt(current)}</span>
          <span className="statunit">{suffix} · bu hafta</span>
        </div>
        <div className="sub">
          {average === null ? 'Karşılaştırma için önceki haftalarda antrenman gerekli.' : `Önceki 4 haftanın ortalaması: ${fmt(average)} ${suffix}`}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Son ${TREND_WEEKS} haftanın ${metric === 'sets' ? 'set sayısı' : 'hacmi'}: ${totals.map((w) => fmt(w[metric])).join(', ')}`}
        style={{ display: 'block' }}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--line)" strokeWidth="1" />
        {totals.map((w, i) => {
          const h = (value(w[metric]) / max) * plotH
          const isCurrent = i === totals.length - 1
          return (
            <rect
              key={w.start}
              x={PAD.l + i * slot + (slot - barW) / 2}
              y={H - PAD.b - h}
              width={barW}
              height={h}
              rx="2"
              fill="var(--accent)"
              fillOpacity={isCurrent ? 1 : 0.45}
            />
          )
        })}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)">{formatAxisDay(totals[0].start, today)}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="10" fill="var(--muted)" textAnchor="end">Bu hafta</text>
      </svg>
      <div className="chips statseg" role="group" aria-label="Haftalık ölçü">
        <button className={`chip${metric === 'sets' ? ' on' : ''}`} aria-pressed={metric === 'sets'} onClick={() => setMetric('sets')}>Set</button>
        <button className={`chip${metric === 'volume' ? ' on' : ''}`} aria-pressed={metric === 'volume'} onClick={() => setMetric('volume')}>Hacim</button>
      </div>
    </div>
  )
}
