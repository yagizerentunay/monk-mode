import type { ProgressionRule } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

const CHOICES: { rule: ProgressionRule; label: string; hint: string }[] = [
  { rule: 'cautious', label: 'Temkinli (önerilen): üst sınırda iki seans + RIR ≥ 2', hint: 'Önce tekrar eklersin; ağırlık yalnız iki seans üst sınırda, her sette RIR en az 2 kalınca artar. RIR girilmemiş seans sayılmaz.' },
  { rule: 'fast', label: 'Hızlı: tek seans yeter', hint: 'Üst sınıra tek seansta ulaşınca ağırlık artar; RIR aranmaz.' },
]

interface EditorProps {
  /** Ayardaki kural; undefined = temkinli. */
  rule: ProgressionRule | undefined
  onChange: (next: ProgressionRule) => void
}

/** Ağırlık artış kuralı seçici (hook yok, saf: testte doğrudan çağrılıp işleyiciler tetiklenir). */
export function ProgressionRuleEditor({ rule, onChange }: EditorProps) {
  const current: ProgressionRule = rule === 'fast' ? 'fast' : 'cautious'
  const hint = CHOICES.find((c) => c.rule === current)!.hint
  return (
    <div className="card stack">
      <div className="eyebrow">Antrenman</div>
      <h2>Ağırlık artış kuralı</h2>
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
            {c.label}
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
