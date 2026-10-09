import {
  MAX_MUSCLE_TARGET,
  MUSCLE_LABEL,
  MUSCLES,
  stepTarget,
  targetFor,
  WEEKLY_TARGET_SETS,
  withTarget,
  type MuscleId,
  type MuscleTargets,
} from '../lib/muscles.ts'
import { useStore } from '../store/useStore.ts'

interface EditorProps {
  targets: MuscleTargets | undefined
  /** Yeni hedefler; undefined = hiç özel hedef yok (hepsi varsayılan). */
  onChange: (next: MuscleTargets | undefined) => void
}

/**
 * Kas başına haftalık hedef düzenleyici (hook yok, saf: testte doğrudan çağrılıp işleyiciler tetiklenir).
 * Her kasın hedefi −/+ ile 0..40 arası ayarlanır; 0 o kasa hedef konmadığı anlamına gelir.
 */
export function MuscleTargetsEditor({ targets, onChange }: EditorProps) {
  const custom = targets !== undefined && Object.keys(targets).length > 0
  const step = (m: MuscleId, delta: number) => onChange(withTarget(targets, m, stepTarget(targetFor(targets, m), delta)))

  return (
    <div className="card stack tgt-card">
      <div className="eyebrow">Kas haritası</div>
      <h2>Haftalık kas hedefleri</h2>
      <p className="sub" style={{ margin: 0 }}>
        Kas başına haftalık set hedefi. Kesin bilimsel bir hedef değil, ayarlanabilir bir kılavuz: varsayılan {WEEKLY_TARGET_SETS} set,
        0–{MAX_MUSCLE_TARGET} arası değiştirebilirsin. 0 yaparsan o kasa hedef konmaz ve eksik sayılmaz.
      </p>
      <div className="tgt-list">
        {MUSCLES.map((m) => {
          const v = targetFor(targets, m)
          const label = MUSCLE_LABEL[m]
          return (
            <div key={m} className={`tgt-row${v !== WEEKLY_TARGET_SETS ? ' custom' : ''}`}>
              <span className="tgt-name">
                {label}
                {v === 0 && <small className="tgt-none">hedef yok</small>}
              </span>
              <button
                type="button"
                className="btn small tgt-btn"
                aria-label={`${label} hedefini azalt`}
                disabled={v <= 0}
                onClick={() => step(m, -1)}
              >
                −
              </button>
              <output className="tgt-val" aria-label={`${label} haftalık hedef (set)`}>
                {v}
              </output>
              <button
                type="button"
                className="btn small tgt-btn"
                aria-label={`${label} hedefini artır`}
                disabled={v >= MAX_MUSCLE_TARGET}
                onClick={() => step(m, 1)}
              >
                +
              </button>
            </div>
          )
        })}
      </div>
      <button type="button" className="btn block" disabled={!custom} onClick={() => onChange(undefined)}>
        Varsayılana dön
      </button>
    </div>
  )
}

/** Ayarlar ekranındaki kart: hedefleri depodan okur, değişikliği ayarlara yazar. */
export function MuscleTargetsCard() {
  const targets = useStore((s) => s.settings.muscleTargets)
  const setSettings = useStore((s) => s.setSettings)
  return <MuscleTargetsEditor targets={targets} onChange={(muscleTargets) => setSettings({ muscleTargets })} />
}
