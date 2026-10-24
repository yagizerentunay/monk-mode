import { t } from '../i18n/index.ts'
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
      <div className="eyebrow">{t('muscleCard.title')}</div>
      <h2>{t('targets.title')}</h2>
      <p className="sub" style={{ margin: 0 }}>
        {t('targets.hint', { n: WEEKLY_TARGET_SETS, max: MAX_MUSCLE_TARGET })}
      </p>
      <div className="tgt-list">
        {MUSCLES.map((m) => {
          const v = targetFor(targets, m)
          const label = MUSCLE_LABEL[m]
          return (
            <div key={m} className={`tgt-row${v !== WEEKLY_TARGET_SETS ? ' custom' : ''}`}>
              <span className="tgt-name">
                {label}
                {v === 0 && <small className="tgt-none">{t('muscleCard.noTarget')}</small>}
              </span>
              <button
                type="button"
                className="btn small tgt-btn"
                aria-label={t('targets.decrease', { muscle: label })}
                disabled={v <= 0}
                onClick={() => step(m, -1)}
              >
                −
              </button>
              <output className="tgt-val" aria-label={t('targets.valueAria', { muscle: label })}>
                {v}
              </output>
              <button
                type="button"
                className="btn small tgt-btn"
                aria-label={t('targets.increase', { muscle: label })}
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
        {t('targets.reset')}
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
