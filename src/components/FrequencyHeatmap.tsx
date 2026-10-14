import { formatDayTitle, weekdayOrder } from '../lib/calendar.ts'
import { DAY_SHORT } from '../lib/dates.ts'
import { cellLabel, HEAT_LEGEND, type HeatmapGrid } from '../lib/frequency.ts'

interface Props {
  grid: HeatmapGrid
  /** Satır sırası için hafta başlangıcı (0 Pazar … 6 Cumartesi). */
  weekStart: number
}

/**
 * GitHub tarzı antrenman sıklığı ısı haritası (hook yok, saf). Sütunlar haftalar, satırlar haftanın günleridir.
 * Hücreler odaklanılamaz (klavye tuzağı yok); her hücrenin tarih ve set sayısı `aria-label`/`title`'dadır ve
 * renk tek ipucu olmasın diye gösterge kademeleri sayı aralıklarıyla yazılır.
 */
export function FrequencyHeatmap({ grid, weekStart }: Props) {
  const cols = grid.weeks.length
  const style = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
  const first = grid.weeks[0]?.[0]
  const last = grid.weeks[cols - 1]?.[6]
  return (
    <div className="heat">
      <div className="heat-months" style={style} aria-hidden="true">
        {grid.monthLabels.map((m) => (
          <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>
        ))}
      </div>
      <div className="heat-body">
        <div className="heat-dows" aria-hidden="true">
          {weekdayOrder(weekStart).map((d, i) => (
            <span key={d}>{i % 2 === 0 ? DAY_SHORT[d] : ''}</span>
          ))}
        </div>
        <div
          className="heat-grid"
          style={style}
          role="group"
          aria-label={first && last ? `Günlük set sayısı, ${formatDayTitle(first.date)} - ${formatDayTitle(last.date)}` : 'Günlük set sayısı'}
        >
          {grid.weeks.flat().map((day) =>
            day.future ? (
              <div key={day.date} className="heat-cell heat-future" aria-hidden="true" />
            ) : (
              <div
                key={day.date}
                className={`heat-cell heat-l${day.level}${day.isToday ? ' heat-today' : ''}`}
                role="img"
                aria-label={cellLabel(day)}
                title={cellLabel(day)}
              />
            ),
          )}
        </div>
      </div>
      <div className="heat-legend" aria-label="Renk göstergesi: günlük tamamlanan set sayısı" role="group">
        {HEAT_LEGEND.map((l) => (
          <span key={l.level} className="heat-key">
            <span className={`heat-cell heat-l${l.level}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
        <span className="heat-key">set / gün</span>
      </div>
    </div>
  )
}
