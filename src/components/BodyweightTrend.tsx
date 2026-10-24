import { labels, t } from '../i18n/index.ts'
import { useState } from 'react'
import { averageOver, dayIndex, formatRate, goalStatus, weeklyRate } from '../lib/bodyweight.ts'
import { formatWeight } from '../lib/units.ts'
import { dayString } from '../lib/workout.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  /** Yalnız haftalık değişim ve hedef satırları (Ana Sayfa'da yer kazanmak için). */
  compact?: boolean
}

const STATUS_TEXT = labels({ on: 'bwTrend.on', below: 'bwTrend.below', above: 'bwTrend.above' })

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
    <div className="stack bwtrend">
      {!compact && (
        <>
          <div className="row between">
            <span className="sub">{t('bwTrend.avg7')}</span>
            <b className="bwval">{avg === null ? '—' : `${formatWeight(avg, unit)} ${unit}`}</b>
          </div>
          {avg !== null && prev !== null && (
            <div className="row between">
              <span className="sub">{t('bwTrend.vsPrev7')}</span>
              <b className="bwval">{formatRate(avg - prev, unit)}</b>
            </div>
          )}
        </>
      )}
      <div className="row between">
        <span className="sub">{t('bwTrend.weekly')}</span>
        <b className="bwval">{rate === null ? t('bwTrend.notEnough') : formatRate(rate, unit)}</b>
      </div>
      {rate === null && (
        <div className="sub">{t('bwTrend.needData')}</div>
      )}
      {goal !== undefined && (
        <div className="row between">
          <span className="sub">{t('bwTrend.goal', { rate: formatRate(goal, unit) })}</span>
          {rate === null ? (
            <span className="sub">—</span>
          ) : (
            <b className={goalStatus(rate, goal) === 'on' ? 'okbadge' : 'warntext'}>{STATUS_TEXT[goalStatus(rate, goal)]}</b>
          )}
        </div>
      )}
    </div>
  )
}
