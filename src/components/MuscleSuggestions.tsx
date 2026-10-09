import { useMemo, useState } from 'react'
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
  return s.timesDone > 0 ? `${s.timesDone} antrenmanda yaptın` : 'Henüz yapmadın'
}

/**
 * Kas için egzersiz önerileri (hook yok, saf: testte doğrudan çağrılıp işleyiciler tetiklenir).
 * Her satırda "Rutine ekle" rutin seçicisini açar; seçilen rutinde zaten olan egzersiz "Zaten ekli" görünür.
 * Rutin yoksa düğme yerine yönlendirme gösterilir.
 */
export function MuscleSuggestionList({ muscle, suggestions, routines, openId, notice, loading, onToggle, onAdd }: ListProps) {
  const label = MUSCLE_LABEL[muscle]
  return (
    <section className="tgt-suggest" aria-label={`${label} için egzersiz önerileri`}>
      <b>{label} için öneriler</b>
      {loading ? (
        <div className="sub">Egzersizler yükleniyor…</div>
      ) : suggestions.length === 0 ? (
        <div className="sub">Bu kas için önerilecek bir egzersiz bulunamadı.</div>
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
                      aria-label={`${s.ex.name} egzersizini rutine ekle`}
                      aria-expanded={open}
                      onClick={() => onToggle(s.ex.id)}
                    >
                      Rutine ekle
                    </button>
                  )}
                </div>
                {open && (
                  <div className="tgt-picker" role="group" aria-label={`${s.ex.name} için rutin seç`}>
                    {routines.map((r) =>
                      routineHas(r, s.ex.id) ? (
                        <span key={r.id} className="tgt-had">{r.name} · Zaten ekli</span>
                      ) : (
                        <button
                          key={r.id}
                          type="button"
                          className="chip"
                          aria-label={`${s.ex.name} egzersizini ${r.name} rutinine ekle`}
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
        <div className="sub">Rutine eklemek için önce Plan sekmesinde bir rutin oluştur.</div>
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
    setNotice(`${ex.name}, "${next.name}" rutinine eklendi.`)
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
