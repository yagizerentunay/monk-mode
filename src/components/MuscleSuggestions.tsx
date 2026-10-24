import { useMemo, useState } from 'react'
import { t } from '../i18n/index.ts'
import { nameLang, type Exercise } from '../lib/exercises.ts'
import { equipmentLabel } from '../lib/labels.ts'
import { suggestExercises, type Suggestion } from '../lib/muscleSuggest.ts'
import { MUSCLE_LABEL, type MuscleId } from '../lib/muscles.ts'
import { addToRoutineById, routineHas } from '../lib/routineAdd.ts'
import { useExercises } from '../lib/useExercises.ts'
import type { Routine } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

interface ListProps {
  muscle: MuscleId
  suggestions: Suggestion[]
  routines: Routine[]
  /** Rutin seçicisi açık olan önerinin egzersiz kimliği. */
  openId: string | null
  /** Son ekleme sonucu (ekran okuyucuya da duyurulur). */
  notice: string | null
  loading?: boolean
  onToggle: (exId: string) => void
  onAdd: (routineId: string, ex: Exercise) => void
}

/** Kullanıcının bu egzersizle geçmişi: kaç antrenmanda yapıldı ya da hiç yapılmadı. */
function usage(s: Suggestion): string {
  return s.timesDone > 0 ? t('suggest.done', { n: s.timesDone }) : t('suggest.notYet')
}

/**
 * Kas için egzersiz önerileri (hook yok, saf: testte doğrudan çağrılıp işleyiciler tetiklenir).
 * Her satırda "Rutine ekle" rutin seçicisini açar; seçilen rutinde zaten olan egzersiz "Zaten ekli" görünür.
 * Rutin yoksa düğme yerine yönlendirme gösterilir.
 */
export function MuscleSuggestionList({ muscle, suggestions, routines, openId, notice, loading, onToggle, onAdd }: ListProps) {
  const label = MUSCLE_LABEL[muscle]
  return (
    <section className="tgt-suggest" aria-label={t('suggest.aria', { muscle: label })}>
      <b>{t('suggest.title', { muscle: label })}</b>
      {loading ? (
        <div className="sub">{t('suggest.loading')}</div>
      ) : suggestions.length === 0 ? (
        <div className="sub">{t('suggest.none')}</div>
      ) : (
        <ul className="tgt-sugg-list">
          {suggestions.map((s) => {
            const open = openId === s.ex.id
            return (
              <li key={s.ex.id} className="tgt-sugg">
                <div className="row between">
                  <div className="grow">
                    <div className="exname" lang={nameLang(s.ex)}>{s.ex.name}</div>
                    <div className="sub">{equipmentLabel(s.ex.equipment)} · {usage(s)}</div>
                  </div>
                  {routines.length > 0 && (
                    <button
                      type="button"
                      className="btn small"
                      aria-label={t('suggest.addAria', { name: s.ex.name })}
                      aria-expanded={open}
                      onClick={() => onToggle(s.ex.id)}
                    >
                      {t('suggest.add')}
                    </button>
                  )}
                </div>
                {open && (
                  <div className="tgt-picker" role="group" aria-label={t('suggest.pickAria', { name: s.ex.name })}>
                    {routines.map((r) =>
                      routineHas(r, s.ex.id) ? (
                        <span key={r.id} className="tgt-had">{r.name} · {t('suggest.already')}</span>
                      ) : (
                        <button
                          key={r.id}
                          type="button"
                          className="chip"
                          aria-label={t('suggest.addToAria', { name: s.ex.name, routine: r.name })}
                          onClick={() => onAdd(r.id, s.ex)}
                        >
                          {r.name}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!loading && suggestions.length > 0 && routines.length === 0 && (
        <div className="sub">{t('suggest.needRoutine')}</div>
      )}
      {notice && <div className="sub tgt-notice" role="status">{notice}</div>}
    </section>
  )
}

/**
 * Seçili kasın öneri paneli: kütüphaneden (kas düzeltmeleri uygulanmış) ve geçmişten önerileri çıkarır.
 * Rutine yalnız kullanıcı dokununca eklenir; hiçbir rutin kendiliğinden değişmez.
 */
export function MuscleSuggestions({ muscle }: { muscle: MuscleId }) {
  const { list, loading } = useExercises()
  const workouts = useStore((s) => s.workouts)
  const routines = useStore((s) => s.routines)
  const saveRoutine = useStore((s) => s.saveRoutine)
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const suggestions = useMemo(() => suggestExercises(muscle, list, workouts), [muscle, list, workouts])

  const add = (routineId: string, ex: Exercise) => {
    const next = addToRoutineById(routines, routineId, ex)
    if (!next) return
    saveRoutine(next)
    setOpenId(null)
    setNotice(t('suggest.added', { name: ex.name, routine: next.name }))
  }

  return (
    <MuscleSuggestionList
      muscle={muscle}
      suggestions={suggestions}
      routines={routines}
      openId={openId}
      notice={notice}
      loading={loading}
      onToggle={(id) => {
        setNotice(null)
        setOpenId((cur) => (cur === id ? null : id))
      }}
      onAdd={add}
    />
  )
}
