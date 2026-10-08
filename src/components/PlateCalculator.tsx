import { useState } from 'react'
import { formatPlates, platesFor } from '../lib/plates.ts'
import { formatWeight, kgToUnit, roundTo, unitToKg } from '../lib/units.ts'
import { useStore } from '../store/useStore.ts'
import { NumberField } from './NumberField.tsx'

interface Props {
  /** Açılışta seçili hedef ağırlık (kg). */
  initialKg: number
  /** Hızlı seçim için egzersizin set ağırlıkları (kg). */
  weights: number[]
}

/** Hedef ağırlığı bar + taraf başına plakalara böler. BottomSheet içinde kullanılır. */
export function PlateCalculator({ initialKg, weights }: Props) {
  const unit = useStore((s) => s.settings.unit)
  const kit = useStore((s) => s.settings.plateKit[unit])
  const [kg, setKg] = useState(initialKg)

  // Veri kg tutulur; birim dönüşümünün yarattığı küsuratı (134,99 lb) temizleyip hesapla.
  const target = roundTo(kgToUnit(kg, unit), 0.1)
  const result = platesFor(target, kit)
  const text = formatPlates(result.perSide)
  const stack = result.perSide.flatMap((p) => Array.from({ length: p.count }, () => p.plate))
  const heaviest = stack[0] ?? 1

  return (
    <div className="stack plate-calc">
      {weights.length > 0 && (
        <div className="chips">
          {weights.map((w) => (
            <button key={w} className={`chip${w === kg ? ' on' : ''}`} onClick={() => setKg(w)}>
              {formatWeight(w, unit)}
            </button>
          ))}
        </div>
      )}

      <div className="row between">
        <span className="eyebrow muted">Hedef ({unit})</span>
        <div className="plate-target">
          <NumberField
            label="Hedef ağırlık"
            value={kg}
            toDisplay={(v) => kgToUnit(v, unit)}
            fromDisplay={(v) => unitToKg(v, unit)}
            step={0.5}
            onChange={setKg}
          />
        </div>
      </div>

      {result.belowBar ? (
        <p className="sub" role="status" style={{ margin: 0 }}>
          Hedef bar ağırlığından ({kit.bar} {unit}) az.
        </p>
      ) : (
        <div className="card stack" role="status">
          <div className="eyebrow">Taraf başına</div>
          <div className="platetext">{text ?? 'Yalnız bar'}</div>
          {stack.length > 0 && (
            <div className="platebar" aria-hidden="true">
              <div className="barstub" />
              {stack.map((p, i) => (
                <div key={i} className="plate" style={{ height: 36 + 52 * (p / heaviest) }}>
                  {p}
                </div>
              ))}
            </div>
          )}
          <div className="sub">
            Bar {kit.bar} {unit} · yük {result.loaded} {unit}
          </div>
          {result.short > 0 && (
            <div className="warntext">
              Eldeki plakalarla tam tutmuyor: en yakın {result.loaded} {unit} ({result.short} {unit} az).
            </div>
          )}
        </div>
      )}
      <p className="sub" style={{ margin: 0 }}>Bar ve plakalar Ayarlar'dan değiştirilir.</p>
    </div>
  )
}
