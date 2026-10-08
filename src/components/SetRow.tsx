import type { SetKind } from '../lib/intensity.ts'
import { SIDES, type Side } from '../lib/sets.ts'
import { kgToUnit, unitToKg, type Unit } from '../lib/units.ts'
import type { SetEntry, SideSet } from '../store/schema.ts'
import { NumberField } from './NumberField.tsx'

const RIR_CHOICES = [0, 1, 2, 3, 4]
const SIDE_LABEL: Record<Side, string> = { L: 'Sol', R: 'Sağ' }
const KIND_LABEL: Record<SetKind, string> = { work: '', warmup: 'Isınma', drop: 'Dropset' }

interface Props {
  /** Erişilebilir ad ve alan etiketlerinin öneki: "Set 1", "Isınma 1", "Drop 1". */
  name: string
  /** Satırın solundaki kısa işaret: set numarası, "Is" (ısınma) veya "↓" (drop). */
  badge: string
  kind: SetKind
  set: SetEntry
  unilateral: boolean
  unit: Unit
  /** "↓ Drop" düğmesi gösterilsin mi (yalnız tamamlanmış ve zincirin son setinde). */
  canDrop: boolean
  onChange: (patch: Partial<SetEntry>) => void
  onSide: (side: Side, patch: Partial<SideSet>) => void
  onDrop: () => void
  onRemove: () => void
  /** Set tamamen bittiğinde (tek taraflıda ikinci taraf da işaretlenince) çağrılır. */
  onCompleted: () => void
  /** Sıradaki (yapılacak ilk) set: bakır çerçeveyle öne çıkar. */
  active?: boolean
}

function CheckButton({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`check${on ? ' on' : ''}`} aria-label={label} onClick={onClick}>
      {on ? '✓' : ''}
    </button>
  )
}

export function SetRow({
  name,
  badge,
  kind,
  set,
  unilateral,
  unit,
  canDrop,
  onChange,
  onSide,
  onDrop,
  onRemove,
  onCompleted,
  active = false,
}: Props) {
  // Isınma setleri her zaman tek satırdır; sol/sağ yalnız `sides` olan setlerde gösterilir.
  const sides = unilateral ? set.sides : undefined

  const weight = (
    <NumberField
      className="grow"
      label={`${name} ağırlık`}
      value={set.w}
      toDisplay={(v) => kgToUnit(v, unit)}
      fromDisplay={(v) => unitToKg(v, unit)}
      step={0.5}
      onChange={(v) => onChange({ w: v })}
    />
  )

  return (
    <div className={`set${set.done ? ' done' : ''}${active && !set.done ? ' active' : ''}${kind === 'work' ? '' : ` ${kind}`}`}>
      {kind !== 'work' && (
        <div className="setlabel">{KIND_LABEL[kind]} {name.split(' ')[1] ?? ''}</div>
      )}
      {sides ? (
        <>
          <div className="setrow">
            <span className="setno">{badge}</span>
            {weight}
            <span className="sub unitnote">{unit} / taraf</span>
          </div>
          {SIDES.map((side) => {
            const s = sides[side]
            const other = sides[side === 'L' ? 'R' : 'L']
            return (
              <div key={side} className="setrow siderow">
                <span className="sidelabel">{SIDE_LABEL[side]}</span>
                <NumberField
                  className="grow"
                  label={`${name} ${SIDE_LABEL[side]} tekrar`}
                  value={s.r}
                  onChange={(v) => onSide(side, { r: Math.round(v) })}
                />
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
          <span className="setno">{badge}</span>
          {weight}
          <NumberField
            className="grow"
            label={`${name} tekrar`}
            value={set.r}
            onChange={(v) => onChange({ r: Math.round(v) })}
          />
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

      {/*
        Çalışma setinde tamamlanınca RIR, drop ve sil; ısınma ve dropta RIR yok. Isınma/dropu yalnız
        henüz yapılmamışken silmek anlamlıdır, tamamlanınca satırı sade tut.
      */}
      {(set.done || (kind !== 'work' && !set.done)) && (
        <div className="rirrow">
          {kind === 'work' && set.done && (
            <>
              <span className="sub rirlabel">RIR</span>
              {RIR_CHOICES.map((r) => (
                <button
                  key={r}
                  className={`chip${set.rir === r ? ' on' : ''}`}
                  onClick={() => onChange({ rir: set.rir === r ? undefined : r })}
                >
                  {r === 4 ? '4+' : r}
                </button>
              ))}
            </>
          )}
          {set.done && canDrop && (
            <button className="chip" onClick={onDrop} aria-label={`${name} sonrası dropset ekle`}>
              ↓ Drop
            </button>
          )}
          {(kind === 'work' ? set.done : !set.done) && (
            <button className="chip" onClick={onRemove} aria-label={`${name} sil`}>Sil</button>
          )}
        </div>
      )}
    </div>
  )
}
