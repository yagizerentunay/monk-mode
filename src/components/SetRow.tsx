import { SIDES, type Side } from '../lib/sets.ts'
import { kgToUnit, unitToKg, type Unit } from '../lib/units.ts'
import type { SetEntry, SideSet } from '../store/schema.ts'
import { NumberField } from './NumberField.tsx'

const RIR_CHOICES = [0, 1, 2, 3, 4]
const SIDE_LABEL: Record<Side, string> = { L: 'Sol', R: 'Sağ' }

interface Props {
  index: number
  set: SetEntry
  unilateral: boolean
  unit: Unit
  onChange: (patch: Partial<SetEntry>) => void
  onSide: (side: Side, patch: Partial<SideSet>) => void
  onRemove: () => void
  /** Set tamamen bittiğinde (tek taraflıda ikinci taraf da işaretlenince) çağrılır. */
  onCompleted: () => void
}

function CheckButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`check${on ? ' on' : ''}`} aria-label={label} onClick={onClick}>
      ✓
    </button>
  )
}

export function SetRow({ index, set, unilateral, unit, onChange, onSide, onRemove, onCompleted }: Props) {
  const n = index + 1
  const sides = unilateral ? set.sides : undefined

  const weight = (
    <NumberField
      className="grow"
      label={`Set ${n} ağırlık`}
      value={set.w}
      toDisplay={(v) => kgToUnit(v, unit)}
      fromDisplay={(v) => unitToKg(v, unit)}
      step={0.5}
      onChange={(v) => onChange({ w: v })}
    />
  )

  return (
    <div className={`set${set.done ? ' done' : ''}`}>
      {sides ? (
        <>
          <div className="setrow">
            <span className="setno">{n}</span>
            {weight}
            <span className="sub">{unit} / taraf</span>
          </div>
          {SIDES.map((side) => {
            const s = sides[side]
            const other = sides[side === 'L' ? 'R' : 'L']
            return (
              <div key={side} className="setrow siderow">
                <span className="sidelabel">{SIDE_LABEL[side]}</span>
                <NumberField
                  className="grow"
                  label={`Set ${n} ${SIDE_LABEL[side]} tekrar`}
                  value={s.r}
                  onChange={(v) => onSide(side, { r: Math.round(v) })}
                />
                <span className="sub">tkr</span>
                <CheckButton
                  on={s.done}
                  label={`${SIDE_LABEL[side]} tarafı ${s.done ? 'geri al' : 'tamamla'}`}
                  onClick={() => {
                    onSide(side, { done: !s.done })
                    if (!s.done && other.done) onCompleted()
                  }}
                />
              </div>
            )
          })}
        </>
      ) : (
        <div className="setrow">
          <span className="setno">{n}</span>
          {weight}
          <span className="sub">{unit}</span>
          <NumberField
            className="grow"
            label={`Set ${n} tekrar`}
            value={set.r}
            onChange={(v) => onChange({ r: Math.round(v) })}
          />
          <span className="sub">tkr</span>
          <CheckButton
            on={set.done}
            label={set.done ? 'Seti geri al' : 'Seti tamamla'}
            onClick={() => {
              onChange({ done: !set.done })
              if (!set.done) onCompleted()
            }}
          />
        </div>
      )}

      {set.done && (
        <div className="rirrow">
          <span className="sub">RIR</span>
          {RIR_CHOICES.map((r) => (
            <button
              key={r}
              className={`chip${set.rir === r ? ' on' : ''}`}
              onClick={() => onChange({ rir: set.rir === r ? undefined : r })}
            >
              {r === 4 ? '4+' : r}
            </button>
          ))}
          <button className="chip" onClick={onRemove} aria-label="Seti sil">Sil</button>
        </div>
      )}
    </div>
  )
}
