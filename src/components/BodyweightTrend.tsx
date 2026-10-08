import { useState } from 'react'
import { averageOver, dayIndex, formatRate, goalStatus, weeklyRate } from '../lib/bodyweight.ts'
import { formatWeight } from '../lib/units.ts'
import { dayString } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  /** Yalnız haftalık değişim ve hedef satırları (Ana Sayfa'da yer kazanmak için). */
  compact?: boolean
}

const STATUS_TEXT = { on: 'Hedefte ✓', below: 'Hedeften düşük', above: 'Hedeften yüksek' } as const

/** Vücut ağırlığı için 7 günlük ortalama, haftalık değişim hızı ve (varsa) hedefe göre durum. */
export function BodyweightTrend({ compact = false }: Props) {
  const bodyweight = useStore((s) => s.bodyweight)
  const unit = useStore((s) => s.settings.unit)
  const goal = useStore((s) => s.settings.bodyweightGoal)
  const [today] = useState(() => dayIndex(dayString()))

  if (bodyweight.length === 0) return null

  const avg = averageOver(bodyweight, today, 7)
  const prev = averageOver(bodyweight, today - 7, 7)
  const rate = weeklyRate(bodyweight, today)

  return (
    <div className="stack">
      {!compact && (
        <>
          <div className="row between">
            <span className="sub">Son 7 gün ortalaması</span>
            <b>{avg === null ? '—' : `${formatWeight(avg, unit)} ${unit}`}</b>
          </div>
          {avg !== null && prev !== null && (
            <div className="row between">
              <span className="sub">Önceki 7 güne göre</span>
              <b>{formatRate(avg - prev, unit)}</b>
            </div>
          )}
        </>
      )}
      <div className="row between">
        <span className="sub">Haftalık değişim (son 4 hafta)</span>
        <b>{rate === null ? 'Yeterli veri yok' : formatRate(rate, unit)}</b>
      </div>
      {rate === null && (
        <div className="sub">Hız için son 4 haftada en az 3 tartı ve 10 günlük aralık gerekir.</div>
      )}
      {goal !== undefined && (
        <div className="row between">
          <span className="sub">Hedef {formatRate(goal, unit)}</span>
          {rate === null ? (
            <span className="sub">—</span>
          ) : (
            <b className={goalStatus(rate, goal) === 'on' ? undefined : 'warntext'}>{STATUS_TEXT[goalStatus(rate, goal)]}</b>
          )}
        </div>
      )}
    </div>
  )
}
