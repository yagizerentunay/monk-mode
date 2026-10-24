import { useState } from 'react'
import { formatAxisDay } from '../lib/calendar.ts'
import {
  lastChange,
  MEASURE_KEYS,
  MEASURE_LABEL,
  MEASURE_UNIT,
  measureSeries,
  parseMeasure,
  type MeasureKey,
} from '../lib/measurements.ts'
import { formatDecimal } from '../lib/units.ts'
import { dayString } from '../lib/workout.ts'
import type { MeasurementEntry } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { BottomSheet } from './BottomSheet.tsx'
import { LineChart } from './LineChart.tsx'

type Draft = Record<MeasureKey, string>

const fieldLabel = (k: MeasureKey) => `${MEASURE_LABEL[k]} (${MEASURE_UNIT[k]})`

/** Bugünkü kayıt varsa form onun değerleriyle açılır; kaydetmek o günün kaydının yerine geçer. */
function draftFrom(entry: MeasurementEntry | undefined): Draft {
  return Object.fromEntries(
    MEASURE_KEYS.map((k) => [k, entry?.[k] === undefined ? '' : formatDecimal(entry[k])]),
  ) as Draft
}

/** İstatistik ekranında vücut ölçüleri: günlük giriş, ölçü seçimi, seyir grafiği ve son değişim. */
export function MeasurementsCard() {
  const measurements = useStore((s) => s.measurements)
  const logMeasurement = useStore((s) => s.logMeasurement)
  const [chosen, setChosen] = useState<MeasureKey | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  // Seçim yoksa verisi olan ilk ölçü gösterilir.
  const selected = chosen ?? MEASURE_KEYS.find((k) => measurements.some((m) => m[k] !== undefined)) ?? 'waist'
  const series = measureSeries(measurements, selected)
  const last = series[series.length - 1]
  const delta = lastChange(series)
  const unit = MEASURE_UNIT[selected]

  const parsed = draft ? MEASURE_KEYS.map((k) => [k, parseMeasure(k, draft[k])] as const) : []
  const invalid = parsed.some(([, v]) => v === null)
  const empty = parsed.every(([, v]) => v === undefined)

  const open = () => {
    const today = dayString()
    setDraft(draftFrom(measurements.find((m) => m.d === today)))
  }

  const save = () => {
    const entry: MeasurementEntry = { d: dayString() }
    for (const [k, v] of parsed) if (typeof v === 'number') entry[k] = v
    logMeasurement(entry)
    setDraft(null)
  }

  return (
    <div className="card stack">
      <div className="row between">
        <div>
          <div className="eyebrow">Vücut ölçüleri</div>
          <h2 style={{ margin: 0 }}>Ölçüler</h2>
        </div>
        <button className="btn small" onClick={open}>Ölçü ekle</button>
      </div>
      {measurements.length === 0 ? (
        <p className="sub" style={{ margin: 0 }}>Henüz ölçü yok. Bel, göğüs, kol, kalça ya da yağ oranını kaydedince seyri burada görünür.</p>
      ) : (
        <>
          <div className="chips statseg" role="group" aria-label="Vücut ölçüsü">
            {MEASURE_KEYS.map((k) => (
              <button key={k} className={`chip${selected === k ? ' on' : ''}`} aria-pressed={selected === k} onClick={() => setChosen(k)}>
                {MEASURE_LABEL[k]}
              </button>
            ))}
          </div>
          {last && (
            <div>
              <div className="row statbig">
                <span className="bignum">{formatDecimal(last.value)}</span>
                <span className="statunit">{unit} · {MEASURE_LABEL[selected].toLocaleLowerCase('tr-TR')} · {formatAxisDay(last.d)}</span>
              </div>
              {delta === null ? (
                <div className="sub">Karşılaştırma için bir ölçüm daha gerekli.</div>
              ) : (
                <div className="statdelta">
                  {delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '= '}{formatDecimal(delta)} {unit} · önceki ölçüme göre
                </div>
              )}
            </div>
          )}
          <LineChart unit={unit} points={series.map((p) => ({ label: formatAxisDay(p.d), value: p.value }))} />
        </>
      )}

      <BottomSheet open={draft !== null} onClose={() => setDraft(null)} title="Bugünkü ölçüler">
        {draft && (
          <div className="stack">
            <p className="sub" style={{ margin: 0 }}>Ölçmediğin alanı boş bırak. Bugün için kayıt varsa yerine geçer.</p>
            {MEASURE_KEYS.map((k) => (
              <label key={k} className="field">
                <span className="sub">{fieldLabel(k)}</span>
                <input
                  className="input num"
                  inputMode="decimal"
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              </label>
            ))}
            {invalid && <p className="warntext" role="alert" style={{ margin: 0 }}>Geçersiz değer: çevre 0-300 cm, yağ oranı 0-99,9 % arasında olmalı.</p>}
            <button className="btn primary block" disabled={invalid || empty} onClick={save}>
              Ölçüleri kaydet
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
