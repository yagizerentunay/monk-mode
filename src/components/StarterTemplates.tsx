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
  return timed ? `${e.sets} × ${range} sn` : `${e.sets} × ${range}`
}

/**
 * "Başlangıç şablonları" seçimi: Full Body, Upper/Lower ve PPL. Her şablonun içeriği eklenmeden önce görülebilir;
 * katalogda olmayan hareketlerin geçici ikamesi açıkça yazılır.
 */
export function StarterTemplates({ onAdded }: Props) {
  const { byId, loading, error } = useExercises()

  const add = (t: StarterTemplate) => {
    if (addTemplateRoutines(t, byId)) onAdded()
  }

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        Yeni başlayanlar için hazır rutinler. Eklenince normal rutinlerin gibi düzenlenir; ağırlıkları ilk seansta
        girersin. Mevcut rutinlerin değişmez.
      </p>
      {error && <p className="sub" role="alert">Egzersiz verisi yüklenemedi: {error}</p>}
      {STARTER_TEMPLATES.map((t) => {
        const subs = substitutesOf(t)
        return (
          <div key={t.id} className="card stack" data-template={t.id}>
            <div className="row between">
              <div className="exname">{t.name}</div>
              {t.recommended && <span className="badge on">Önerilen başlangıç</span>}
            </div>
            <div className="sub" style={{ margin: 0 }}>{t.summary}</div>
            <div className="sub" style={{ margin: 0 }}>{t.schedule}</div>
            {t.note && <p className="sub banner-title" style={{ margin: 0 }}>⚠ {t.note}</p>}
            <details>
              <summary>İçeriği gör</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                {t.days.map((day) => (
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
                    Geçici ikame: {subs.map((s) => `${byId.get(s.exId)?.name ?? s.exId} (${s.for} yerine)`).join(', ')}.
                    Bu hareketler kütüphaneye eklenince şablon güncellenir; eklediğin rutinler değişmez.
                  </p>
                )}
              </div>
            </details>
            <button
              className={`btn block${t.recommended ? ' primary' : ''}`}
              disabled={loading}
              onClick={() => add(t)}
            >
              {t.days.length} rutini ekle
            </button>
          </div>
        )
      })}
    </div>
  )
}
