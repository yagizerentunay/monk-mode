import { missingRirByExercise, missingRirCount, RIR_CHOICES, rirCoverage, rirLabel } from '../lib/rir.ts'
import type { Workout } from '../store/schema.ts'

interface Props {
  workout: Workout
  /** Egzersizin görünen adı (ve İngilizce adlar için dil işareti). */
  describeEx: (exId: string) => { name: string; lang?: 'en' }
  /** Karta "Atla" denmiş: eksik kartı gizlenir, kapsama satırı kalır. Hiçbir şey yazılmaz. */
  skipped: boolean
  /** Egzersizin RIR'i boş setlerinin hepsine `rir` yazılır; yalnız kullanıcının chip'e dokunuşuyla çağrılır. */
  onApply: (entryIdx: number, rir: number) => void
  onSkip: () => void
}

/**
 * Antrenman özeti ekranında RIR kapsaması ve eksik RIR'leri toplu doldurma kartı. Kart yalnız RIR'i boş
 * tamamlanmış çalışma seti varken çıkar; ısınma ve dropset sayılmaz. Hiçbir değer kendiliğinden yazılmaz.
 */
export function RirSummary({ workout, describeEx, skipped, onApply, onSkip }: Props) {
  const { pct } = rirCoverage(workout)
  if (pct === null) return null // tamamlanmış çalışma seti yok: söylenecek bir şey de yok

  const coverage = <div className="sub rir-coverage">Bu antrenmanda setlerin %{pct}'inde RIR var</div>
  const rows = missingRirByExercise(workout)
  if (skipped || rows.length === 0) return coverage

  return (
    <div className="card stack rir-card">
      <div>
        <div className="eyebrow">RIR eksik: {missingRirCount(workout)} set</div>
        {coverage}
      </div>
      {rows.map((m) => {
        const ex = describeEx(m.exId)
        return (
          <div key={m.entryIdx} className="rir-exrow">
            <div className="row between">
              <span className="exname rir-exname" lang={ex.lang}>{ex.name}</span>
              <span className="sub">{m.count} set</span>
            </div>
            <div className="rir-chips">
              <span className="sub rirlabel">Hepsi</span>
              {RIR_CHOICES.map((r) => (
                <button
                  key={r}
                  className="chip"
                  aria-label={`${ex.name}: ${m.count} setin hepsine RIR ${rirLabel(r)} yaz`}
                  onClick={() => onApply(m.entryIdx, r)}
                >
                  {rirLabel(r)}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <button className="btn small rir-skip" aria-label="RIR girişini atla" onClick={onSkip}>Atla</button>
    </div>
  )
}
