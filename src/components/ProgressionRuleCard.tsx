import { t, type MessageKey } from '../i18n/index.ts'
import type { ProgressionRule } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

const CHOICES: { rule: ProgressionRule; label: MessageKey; hint: MessageKey }[] = [
  { rule: 'cautious', label: 'rule.cautious', hint: 'rule.cautiousHint' },
  { rule: 'fast', label: 'rule.fast', hint: 'rule.fastHint' },
]

interface EditorProps {
  /** Ayardaki kural; undefined = temkinli. */
  rule: ProgressionRule | undefined
  onChange: (next: ProgressionRule) => void
}

/** Ağırlık artış kuralı seçici (hook yok, saf: testte doğrudan çağrılıp işleyiciler tetiklenir). */
export function ProgressionRuleEditor({ rule, onChange }: EditorProps) {
  const current: ProgressionRule = rule === 'fast' ? 'fast' : 'cautious'
  const hint = t(CHOICES.find((c) => c.rule === current)!.hint)
  return (
    <div className="card stack">
      <div className="eyebrow">{t('workout.menuTitle')}</div>
      <h2>{t('rule.title')}</h2>
      {/* Uzun etiketler yatay kaydırmak yerine alt alta, sarılarak dizilir. */}
      <div className="chips" style={{ flexDirection: 'column', overflowX: 'visible' }}>
        {CHOICES.map((c) => (
          <button
            key={c.rule}
            type="button"
            className={`chip${current === c.rule ? ' on' : ''}`}
            aria-pressed={current === c.rule}
            style={{ textAlign: 'left', borderRadius: 16 }}
            onClick={() => onChange(c.rule)}
          >
            {t(c.label)}
          </button>
        ))}
      </div>
      <p className="sub" style={{ margin: 0 }}>{hint}</p>
    </div>
  )
}

/** Ayarlar ekranındaki kart: kuralı depodan okur, seçimi ayarlara yazar (temkinli = ayar yok). */
export function ProgressionRuleCard() {
  const rule = useStore((s) => s.settings.progressionRule)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <ProgressionRuleEditor
      rule={rule}
      onChange={(next) => setSettings({ progressionRule: next === 'fast' ? 'fast' : undefined })}
    />
  )
}
