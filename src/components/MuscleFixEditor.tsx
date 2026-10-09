import { useState } from 'react'
import type { Exercise } from '../lib/exercises.ts'
import { muscleLabel } from '../lib/labels.ts'
import { normalizeMuscleFix, sameMuscleFix, selectionOf, toggleMuscle, type MuscleFix } from '../lib/muscleFix.ts'
import { MUSCLES, SECONDARY_WEIGHT } from '../lib/muscles.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  ex: Exercise
  onClose: () => void
}

function MuscleChips({
  group,
  sel,
  onToggle,
}: {
  group: 'primary' | 'secondary'
  sel: MuscleFix
  onToggle: (group: 'primary' | 'secondary', muscle: string) => void
}) {
  return (
    <div className="row wrap">
      {MUSCLES.map((m) => (
        <button
          key={m}
          type="button"
          className={`chip${sel[group].includes(m) ? ' on' : ''}`}
          aria-pressed={sel[group].includes(m)}
          onClick={() => onToggle(group, m)}
        >
          {muscleLabel(m)}
        </button>
      ))}
    </div>
  )
}

/**
 * Egzersizin çalıştırdığı kasları düzeltir (ör. veritabanında yanlış etiketli bir egzersiz). Kaydedilen
 * düzeltme kas haritasında, filtrelerde ve değiştirme önerilerinde geçerli olur; seçim kütüphanedeki
 * özgün kaslara geri dönerse düzeltme kaldırılır.
 */
export function MuscleFixEditor({ ex, onClose }: Props) {
  const setFix = useStore((s) => s.setMuscleFix)
  const clearFix = useStore((s) => s.clearMuscleFix)
  const [sel, setSel] = useState<MuscleFix>(() => selectionOf({ primary: ex.primaryMuscles, secondary: ex.secondaryMuscles }))
  const fix = normalizeMuscleFix(sel)
  const base = selectionOf(ex.original ?? { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles })
  const toggle = (group: 'primary' | 'secondary', m: string) => setSel((cur) => toggleMuscle(cur, group, m))

  return (
    <div className="stack musclefix">
      <div className="exname">Kasları düzelt</div>
      <div className="sub">Birincil kaslar kas haritasında tam set, yardımcı kaslar {SECONDARY_WEIGHT} set sayılır.</div>
      <div className="eyebrow">Birincil</div>
      <MuscleChips group="primary" sel={sel} onToggle={toggle} />
      <div className="eyebrow">Yardımcı</div>
      <MuscleChips group="secondary" sel={sel} onToggle={toggle} />
      {!fix && <div className="sub" role="note">En az bir birincil kas seç.</div>}
      <div className="row">
        <button
          type="button"
          className="btn primary grow"
          disabled={!fix}
          onClick={() => {
            if (!fix) return
            if (sameMuscleFix(fix, base)) clearFix(ex.id)
            else setFix(ex.id, fix)
            onClose()
          }}
        >
          Kaydet
        </button>
        <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
      </div>
      {ex.original && (
        <button
          type="button"
          className="btn small"
          onClick={() => {
            clearFix(ex.id)
            onClose()
          }}
        >
          Orijinale dön
        </button>
      )}
    </div>
  )
}
