import { t } from '../i18n/index.ts'
import { isTimedName } from '../lib/exercises.ts'
import { STARTER_TEMPLATES, substitutesOf, type StarterTemplate, type TemplateExercise } from '../lib/starterTemplates.ts'
import { useExercises } from '../lib/useExercises.ts'
import { addTemplateRoutines } from '../store/addTemplate.ts'

interface Props {
  /** Şablon eklendiğinde (sheet kapansın). */
  onAdded: () => void
}

/** Set × tekrar satırı; süreli hareketlerde tekrar yerine saniye yazar. */
function planText(e: TemplateExercise, timed: boolean): string {
  const range = e.reps === e.repsMax ? `${e.reps}` : `${e.reps}–${e.repsMax}`
  return timed ? `${e.sets} × ${t('unit.secValue', { n: range })}` : `${e.sets} × ${range}`
}

/**
 * "Başlangıç şablonları" seçimi: Full Body, Upper/Lower ve PPL. Her şablonun içeriği eklenmeden önce görülebilir;
 * katalogda olmayan hareketlerin geçici ikamesi açıkça yazılır.
 */
export function StarterTemplates({ onAdded }: Props) {
  const { byId, loading, error } = useExercises()

  const add = (tpl: StarterTemplate) => {
    if (addTemplateRoutines(tpl, byId)) onAdded()
  }

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        {t('tpl.intro')}
      </p>
      {error && <p className="sub" role="alert">{t('tpl.loadFailed', { error })}</p>}
      {STARTER_TEMPLATES.map((tpl) => {
        const subs = substitutesOf(tpl)
        return (
          <div key={tpl.id} className="card stack" data-template={tpl.id}>
            <div className="row between">
              <div className="exname">{tpl.name}</div>
              {tpl.recommended && <span className="badge on">{t('tpl.recommended')}</span>}
            </div>
            <div className="sub" style={{ margin: 0 }}>{tpl.summary}</div>
            <div className="sub" style={{ margin: 0 }}>{tpl.schedule}</div>
            {tpl.note && <p className="sub banner-title" style={{ margin: 0 }}>⚠ {tpl.note}</p>}
            <details>
              <summary>{t('tpl.showContents')}</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                {tpl.days.map((day) => (
                  <div key={day.name}>
                    <b>{day.name}</b>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {day.ex.map((e) => {
                        const name = byId.get(e.exId)?.name ?? e.exId
                        return (
                          <li key={e.exId} className="sub">
                            {name} · {planText(e, isTimedName(name))}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
                {subs.length > 0 && (
                  <p className="sub" style={{ margin: 0 }}>
                    {t('tpl.substitutes', {
                      list: subs.map((s) => `${byId.get(s.exId)?.name ?? s.exId} (${t('swap.insteadOf', { name: s.for })})`).join(', '),
                    })}
                  </p>
                )}
              </div>
            </details>
            <button
              className={`btn block${tpl.recommended ? ' primary' : ''}`}
              disabled={loading}
              onClick={() => add(tpl)}
            >
              {t('tpl.add', { n: tpl.days.length })}
            </button>
          </div>
        )
      })}
    </div>
  )
}
