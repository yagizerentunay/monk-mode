import { t } from '../i18n/index.ts'
import { useState } from 'react'
import { formatAxisDay } from '../lib/calendar.ts'
import { kgToUnit } from '../lib/units.ts'
import { useStore } from '../store/useStore.ts'
import { BodyweightTrend } from './BodyweightTrend.tsx'
import { LineChart } from './LineChart.tsx'

const RANGES = [
  { label: () => t('count.days', { n: 30 }), n: 30 },
  { label: () => t('count.days', { n: 90 }), n: 90 },
  { label: () => t('bw.all'), n: Infinity },
] as const

/** İstatistik ekranında kilo grafiği (aralık seçilebilir) ve trend özeti. */
export function BodyweightCard() {
  const bodyweight = useStore((s) => s.bodyweight)
  const unit = useStore((s) => s.settings.unit)
  const [range, setRange] = useState<(typeof RANGES)[number]['n']>(90)

  // Kayıtlar tarih sırasında; son `n` kayıt değil son `n` günü göstermek için en yeni tarihten geriye bakılır.
  const shown = Number.isFinite(range)
    ? bodyweight.filter((b) => {
        const last = bodyweight[bodyweight.length - 1]?.d
        return last ? (Date.parse(last) - Date.parse(b.d)) / 86400000 < range : true
      })
    : bodyweight

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">{t('bw.eyebrow')}</div>
        <h2 style={{ margin: 0 }}>{t('home.bodyweight')}</h2>
      </div>
      {bodyweight.length === 0 ? (
        <p className="sub" style={{ margin: 0 }}>{t('bw.empty')}</p>
      ) : (
        <>
          <div className="chips statseg">
            {RANGES.map((r) => (
              <button key={r.n} className={`chip${range === r.n ? ' on' : ''}`} onClick={() => setRange(r.n)}>
                {r.label()}
              </button>
            ))}
          </div>
          <LineChart
            unit={unit}
            points={shown.map((b) => ({ label: formatAxisDay(b.d), value: Math.round(kgToUnit(b.w, unit) * 10) / 10 }))}
          />
          <BodyweightTrend />
        </>
      )}
    </div>
  )
}
