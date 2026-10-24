import { t, labels } from '../i18n/index.ts'
import type { SetKind } from '../lib/intensity.ts'
import { formatPace, kmToMeters, metersToKm, setMeters } from '../lib/distance.ts'
import { SIDES, type Side } from '../lib/sets.ts'
import { effectiveLoad } from '../lib/load.ts'
import { RIR_CHOICES, rirLabel } from '../lib/rir.ts'
import { formatWeight, kgToUnit, unitToKg, type Unit } from '../lib/units.ts'
import type { SetEntry, SideSet } from '../store/schema.ts'
import { DurationField } from './DurationField.tsx'
import { HoldTimer } from './HoldTimer.tsx'
import { NumberField } from './NumberField.tsx'

const SIDE_LABEL = labels<Side>({ L: 'side.L', R: 'side.R' })
const KIND_LABEL = labels<Exclude<SetKind, 'work'>>({ warmup: 'workout.warmup', drop: 'set.kindDrop' })
/** Ek yük alanında girilebilecek en büyük asist (kg); bunun altı yazılamaz. */
const MAX_ASSIST = 300

interface Props {
  /** Erişilebilir ad ve alan etiketlerinin öneki: "Set 1", "Isınma 1", "Drop 1". */
  name: string
  /** Satırın solundaki kısa işaret: set numarası, "Is" (ısınma) veya "↓" (drop). */
  badge: string
  kind: SetKind
  set: SetEntry
  unilateral: boolean
  unit: Unit
  /** Vücut ağırlığı egzersizi: ağırlık ek yüktür (negatif = asist); `bwKg` o günün vücut ağırlığı. */
  bw?: boolean
  bwKg?: number
  /** Süreli egzersiz: tekrar yerine saniye girilir (`set.r` saniyedir) ve kronometre düğmesi çıkar. */
  timed?: boolean
  /**
   * Mesafe egzersizi (bkz. lib/distance.ts): ağırlık ve tekrar yerine mesafe (km alanı, metre saklanır) ve
   * süre ("dk" ya da "d:ss") girilir; tempo satırın altında gösterilir. RIR, drop ve sol/sağ yoktur.
   */
  distance?: boolean
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
  /** Tamamlanmış setin ağırlığı 0 görünüyor (bkz. lib/zeroWeight.ts): alan işaretlenir, altına soru satırı çıkar. */
  warnZero?: boolean
  /**
   * Aynı egzersizde önceki tamamlanmış çalışma setinin RIR'i (bkz. lib/rir.ts). RIR'i boş set için
   * "Aynı (N)" önerisi olarak gösterilir; değer yalnız kullanıcı dokununca yazılır, kendiliğinden hiç.
   */
  prevRir?: number
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
  bw = false,
  bwKg,
  timed = false,
  distance = false,
  canDrop,
  onChange,
  onSide,
  onDrop,
  onRemove,
  onCompleted,
  active = false,
  warnZero = false,
  prevRir,
}: Props) {
  // Isınma setleri her zaman tek satırdır; sol/sağ yalnız `sides` olan setlerde gösterilir.
  const sides = unilateral ? set.sides : undefined

  const weight = (
    <NumberField
      className={`grow${warnZero ? ' warnfield' : ''}`}
      label={`${name} ${bw ? t('set.addedLoad') : t('set.weight')}`}
      value={set.w}
      min={bw ? -MAX_ASSIST : undefined}
      toDisplay={(v) => kgToUnit(v, unit)}
      fromDisplay={(v) => unitToKg(v, unit)}
      step={0.5}
      onChange={(v) => onChange({ w: v })}
    />
  )

  if (distance) {
    const pace = formatPace(setMeters(set), set.r)
    return (
      <div className={`set${set.done ? ' done' : ''}${active && !set.done ? ' active' : ''}`}>
        <div className="setrow">
          <span className="setno">{badge}</span>
          <NumberField
            className="grow"
            label={`${name} ${t('set.distance')}`}
            value={setMeters(set)}
            toDisplay={metersToKm}
            fromDisplay={kmToMeters}
            step={0.1}
            onChange={(v) => onChange({ m: v })}
          />
          <DurationField className="grow" long label={`${name} ${t('set.time')}`} value={set.r} onChange={(v) => onChange({ r: v })} />
          <CheckButton
            on={set.done}
            label={set.done ? t('set.undo') : t('set.complete')}
            onClick={() => {
              onChange({ done: !set.done })
              if (!set.done) onCompleted()
            }}
          />
        </div>
        {pace && <div className="sub bwhint">{t('set.pace', { pace })}</div>}
        {set.done && (
          <div className="rirrow">
            <button className="chip" onClick={onRemove} aria-label={t('set.deleteAria', { name })}>{t('set.delete')}</button>
          </div>
        )}
      </div>
    )
  }

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
            <span className="sub unitnote">{t('set.perSide', { unit })}</span>
          </div>
          {SIDES.map((side) => {
            const s = sides[side]
            const other = sides[side === 'L' ? 'R' : 'L']
            return (
              <div key={side} className="setrow siderow">
                <span className="sidelabel">{SIDE_LABEL[side]}</span>
                {timed ? (
                  <DurationField
                    className="grow"
                    label={`${name} ${SIDE_LABEL[side]} ${t('set.time')}`}
                    value={s.r}
                    onChange={(v) => onSide(side, { r: v })}
                  />
                ) : (
                  <NumberField
                    className="grow"
                    label={`${name} ${SIDE_LABEL[side]} ${t('set.reps')}`}
                    value={s.r}
                    onChange={(v) => onSide(side, { r: Math.round(v) })}
                  />
                )}
                <CheckButton
                  on={s.done}
                  label={s.done ? t('set.sideUndo', { side: SIDE_LABEL[side] }) : t('set.sideComplete', { side: SIDE_LABEL[side] })}
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
          {timed ? (
            <DurationField className="grow" label={`${name} ${t('set.time')}`} value={set.r} onChange={(v) => onChange({ r: v })} />
          ) : (
            <NumberField
              className="grow"
              label={`${name} ${t('set.reps')}`}
              value={set.r}
              onChange={(v) => onChange({ r: Math.round(v) })}
            />
          )}
          <CheckButton
            on={set.done}
            label={set.done ? t('set.undo') : t('set.complete')}
            onClick={() => {
              onChange({ done: !set.done })
              if (!set.done) onCompleted()
            }}
          />
        </div>
      )}

      {/* Kronometre yalnız yapılmamış sette; durunca süre alana yazılır, seti tamamlamak kullanıcıya kalır. */}
      {timed && !set.done && (
        <div className="holdrow">
          {sides ? (
            SIDES.map((side) => (
              <HoldTimer
                key={side}
                label={`${name} ${SIDE_LABEL[side]} ${t('set.time')}`}
                caption={SIDE_LABEL[side]}
                onStop={(sec) => onSide(side, { r: sec })}
              />
            ))
          ) : (
            <HoldTimer label={`${name} ${t('set.time')}`} onStop={(sec) => onChange({ r: sec })} />
          )}
        </div>
      )}
      {warnZero && <div className="zerowarn" role="note">{t('set.zeroWarn')}</div>}
      {bw && bwKg !== undefined && (
        <div className="sub bwhint">{t('set.total', { load: `${formatWeight(Math.max(0, effectiveLoad({ bw, bwKg }, set.w)), unit)} ${unit}` })}</div>
      )}

      {/*
        Çalışma setinde tamamlanınca RIR, drop ve sil; ısınma ve dropta RIR yok. Isınma/dropu yalnız
        henüz yapılmamışken silmek anlamlıdır, tamamlanınca satırı sade tut.
      */}
      {(set.done || (kind !== 'work' && !set.done)) && (
        <div className={`rirrow${kind === 'work' && set.done && set.rir === undefined ? ' rir-need' : ''}`}>
          {kind === 'work' && set.done && (
            <>
              {/* RIR boşken satır hafifçe vurgulanır (rir-need); girilince sakinleşir. */}
              <span className="sub rirlabel">RIR</span>
              {RIR_CHOICES.map((r) => (
                <button
                  key={r}
                  className={`chip${set.rir === r ? ' on' : ''}`}
                  aria-label={`${name} RIR ${rirLabel(r)}`}
                  aria-pressed={set.rir === r}
                  onClick={() => onChange({ rir: set.rir === r ? undefined : r })}
                >
                  {rirLabel(r)}
                </button>
              ))}
              {/* Numaralı chip'lerin yerini kaydırmaması için sonda durur; yalnız dokununca yazılır. */}
              {set.rir === undefined && prevRir !== undefined && (
                <button
                  className="chip rir-same"
                  aria-label={t('set.rirSameAria', { name, rir: rirLabel(prevRir) })}
                  onClick={() => onChange({ rir: prevRir })}
                >
                  {t('set.rirSame', { rir: rirLabel(prevRir) })}
                </button>
              )}
            </>
          )}
          {set.done && canDrop && (
            <button className="chip" onClick={onDrop} aria-label={t('set.addDropAria', { name })}>
              ↓ Drop
            </button>
          )}
          {(kind === 'work' ? set.done : !set.done) && (
            <button className="chip" onClick={onRemove} aria-label={t('set.deleteAria', { name })}>{t('set.delete')}</button>
          )}
        </div>
      )}
    </div>
  )
}
