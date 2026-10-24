import { t } from '../i18n/index.ts'
import { fmt, fmtDelta, weekRows } from '../lib/muscleWeek.ts'
import {
  MUSCLE_LABEL,
  muscleLevel,
  underTargetMuscles,
  type MuscleId,
  type MuscleTargets,
  type WeekComparison,
} from '../lib/muscles.ts'

/** Özette varsayılan olarak en fazla kaç kas adı sayılır; kalanı "Tümünü gör" ile açılır. */
export const UNDER_TARGET_LIMIT = 3

interface Props {
  cmp: WeekComparison
  targets: MuscleTargets | undefined
  selected: MuscleId | null
  onSelect: (m: MuscleId) => void
  /** Hedefin altındakilerin tamamı mı yoksa ilk `UNDER_TARGET_LIMIT` mi gösterilsin. */
  showAll: boolean
  onToggleAll: () => void
}

/**
 * "Bu hafta" listesi (hook yok, saf). Hedefi olan her kas, hiç çalışılmamış olsa bile `0/10` gibi bar ve
 * sayıyla görünür. Hafta bitmediği için hedefin altındakiler "eksik" değil "ilerleme" diye çerçevelenir.
 */
export function MuscleWeekList({ cmp, targets, selected, onSelect, showAll, onToggleAll }: Props) {
  const { rows, hidden } = weekRows(cmp, targets)
  const anyWork = rows.some((r) => r.sets > 0 || r.lastWeek > 0)
  const behind = underTargetMuscles(cmp.thisWeek, { targets })
  const shown = showAll ? behind : behind.slice(0, UNDER_TARGET_LIMIT)

  return (
    <>
      <div className="stack">
        <div className="sub">
          {t('muscleWeek.ongoing', { day: cmp.ranges.daysElapsed })}
        </div>
        {!anyWork && (
          <div className="sub">
            {t('muscleWeek.empty')}
          </div>
        )}
        {rows.map((r) => (
          <button
            key={r.muscle}
            type="button"
            className={`musclerow${selected === r.muscle ? ' on' : ''}${r.below ? ' tgt-below' : ''}`}
            aria-pressed={selected === r.muscle}
            onClick={() => onSelect(r.muscle)}
          >
            <span className="mrname">
              {MUSCLE_LABEL[r.muscle]}
              {r.below && <span className="sr-only"> {t('muscleWeek.towardTarget')}</span>}
            </span>
            <span className="mrbar" aria-hidden="true">
              <span style={{ width: `${muscleLevel(r.sets, 7, r.target) * 100}%` }} />
            </span>
            <span className="mrval mrweek">
              {fmt(r.sets)}
              {r.target > 0 ? <small>/{fmt(r.target)}</small> : <small className="tgt-none">{t('muscleCard.noTarget')}</small>}
            </span>
            <span className={`mrdelta${r.delta > 0 ? ' up' : ''}`} title={t('muscleWeek.lastWeekTitle', { n: fmt(r.lastWeek) })}>
              {fmtDelta(r.delta)}
              <span className="sr-only"> {t('muscleWeek.vsLastWeek')}</span>
            </span>
          </button>
        ))}
      </div>

      {behind.length > 0 && (
        <div className="underweek">
          <b>{t('muscleWeek.below')}</b>
          <div className="tgt-chips">
            {shown.map((u) => (
              <button
                key={u.muscle}
                type="button"
                className="tgt-chip"
                aria-label={`${MUSCLE_LABEL[u.muscle]} ${fmt(u.sets)}/${fmt(u.target)} ${t('trend.sets')}`}
                onClick={() => onSelect(u.muscle)}
              >
                {MUSCLE_LABEL[u.muscle]} {fmt(u.sets)}/{fmt(u.target)}
              </button>
            ))}
          </div>
          {behind.length > UNDER_TARGET_LIMIT && (
            <button type="button" className="tgt-more" aria-expanded={showAll} onClick={onToggleAll}>
              {showAll ? t('records.showLess') : t('records.showAll', { n: behind.length })}
            </button>
          )}
          <div className="sub">{t('muscleWeek.progressNote')}</div>
        </div>
      )}

      {hidden.length > 0 && (
        <div className="sub">{t('muscleWeek.hidden', { list: hidden.map((m) => MUSCLE_LABEL[m]).join(', ') })}</div>
      )}
    </>
  )
}
