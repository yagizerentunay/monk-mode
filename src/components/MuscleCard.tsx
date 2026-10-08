import { useMemo, useState } from 'react'
import {
  MUSCLE_LABEL,
  MUSCLES,
  muscleLevel,
  muscleSets,
  sinceDay,
  underTargetMuscles,
  weekComparison,
  WEEKLY_TARGET_SETS,
  type MuscleId,
} from '../lib/muscles.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'
import { MuscleMap } from './MuscleMap.tsx'

const PERIODS = [7, 30] as const
type Period = (typeof PERIODS)[number] | 'week'

/** "Bu hafta" özetinde en fazla kaç kas adı sayılır. */
const UNDER_TARGET_LIMIT = 3

/** 6,5 gibi: tam sayıda ondalık yok, ondalık ayracı virgül. */
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

/** Geçen haftaya göre fark: "+3", "−2", "+0,5"; fark yoksa "=". */
function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10
  if (r === 0) return '='
  return r > 0 ? `+${fmt(r)}` : `−${fmt(-r)}`
}

/**
 * Kas başına ağırlıklı set sayısını gövde şemasında ve listede gösterir.
 * "Son 7 / 30 gün" kayan penceredir; "Bu hafta" kullanıcının hafta başlangıcına göre takvim haftasıdır
 * ve geçen tam haftayla karşılaştırır.
 */
export function MuscleCard() {
  const workouts = useStore((s) => s.workouts)
  const weekStart = useStore((s) => s.settings.weekStart)
  const { byId } = useExercises()
  const [period, setPeriod] = useState<Period>(7)
  const [selected, setSelected] = useState<MuscleId | null>(null)

  const isWeek = period === 'week'
  const days = isWeek ? 7 : period

  const cmp = useMemo(
    () => (isWeek ? weekComparison(workouts, byId, undefined, weekStart) : null),
    [isWeek, workouts, byId, weekStart],
  )
  const rolling = useMemo(
    () => (isWeek ? null : muscleSets(workouts, byId, { from: sinceDay(days) })),
    [isWeek, workouts, byId, days],
  )
  const sets = cmp ? cmp.thisWeek : rolling!
  const levels = useMemo(
    () => Object.fromEntries(MUSCLES.map((m) => [m, muscleLevel(sets[m], days)])) as Record<MuscleId, number>,
    [sets, days],
  )

  // Bu hafta: geçen hafta çalışılıp bu hafta henüz sıfır olan kas da listede kalır (fark görünsün).
  // "Çalışmayan" satırı yalnız iki haftada da hiç çalışılmayanları sayar; hedef özeti ise listede olan
  // (yani bu hafta veya geçen hafta çalışılmış) kaslardan seçilir. Böylece hiçbir kas iki yerde geçmez.
  const worked = cmp
    ? MUSCLES.filter((m) => cmp.thisWeek[m] > 0 || cmp.lastWeek[m] > 0).sort(
        (a, b) => cmp.thisWeek[b] - cmp.thisWeek[a] || cmp.lastWeek[b] - cmp.lastWeek[a],
      )
    : MUSCLES.filter((m) => sets[m] > 0).sort((a, b) => sets[b] - sets[a])
  const idle = MUSCLES.filter((m) => !worked.includes(m))
  const target = (WEEKLY_TARGET_SETS * days) / 7

  const behind = cmp
    ? underTargetMuscles(cmp.thisWeek, {
        limit: UNDER_TARGET_LIMIT,
        eligible: (m) => cmp.thisWeek[m] > 0 || cmp.lastWeek[m] > 0,
      })
    : []

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Kas dağılımı</div>
        <h2 style={{ margin: 0 }}>Kas haritası</h2>
      </div>
      <div className="chips statseg">
        {PERIODS.map((p) => (
          <button key={p} className={`chip${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>
            Son {p} gün
          </button>
        ))}
        <button className={`chip${isWeek ? ' on' : ''}`} onClick={() => setPeriod('week')}>
          Bu hafta
        </button>
      </div>

      <MuscleMap
        levels={levels}
        labels={MUSCLE_LABEL}
        selected={selected}
        onSelect={(m) => setSelected((cur) => (cur === m ? null : m))}
      />

      {selected && (
        <div className="musclesel" role="status">
          <b>{MUSCLE_LABEL[selected]}</b>: {fmt(sets[selected])} set (varsayılan hedef {fmt(target)})
          {cmp && <>, geçen hafta {fmt(cmp.lastWeek[selected])}</>}
        </div>
      )}

      {worked.length === 0 ? (
        <p className="sub" style={{ margin: 0 }}>
          {isWeek
            ? 'Bu hafta ve geçen hafta tamamlanmış set yok. Antrenman bitirince karşılaştırma burada görünür.'
            : 'Bu dönemde tamamlanmış set yok. İlk antrenmanını bitirince dağılım burada görünür.'}
        </p>
      ) : (
        <div className="stack">
          {isWeek && (
            <div className="sub">
              Hafta devam ediyor (gün {cmp!.ranges.daysElapsed}/7). Fark, geçen tam haftayla karşılaştırılır.
            </div>
          )}
          {worked.map((m) => (
            <button
              key={m}
              className={`musclerow${selected === m ? ' on' : ''}`}
              onClick={() => setSelected((cur) => (cur === m ? null : m))}
            >
              <span className="mrname">{MUSCLE_LABEL[m]}</span>
              <span className="mrbar" aria-hidden="true"><span style={{ width: `${levels[m] * 100}%` }} /></span>
              {cmp ? (
                <>
                  <span className="mrval mrweek">
                    {fmt(sets[m])}
                    <small>/{fmt(WEEKLY_TARGET_SETS)}</small>
                  </span>
                  <span
                    className={`mrdelta${cmp.delta[m] > 0 ? ' up' : ''}`}
                    title={`Geçen hafta ${fmt(cmp.lastWeek[m])} set`}
                  >
                    {fmtDelta(cmp.delta[m])}
                    <span className="sr-only"> geçen haftaya göre</span>
                  </span>
                </>
              ) : (
                <span className="mrval">{fmt(sets[m])}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {cmp && behind.length > 0 && (
        <div className="underweek">
          <b>Bu hafta hedefin altında</b>
          <div className="sub">
            {behind.map((u) => `${MUSCLE_LABEL[u.muscle]} ${fmt(u.sets)}/${fmt(u.target)} set`).join(' · ')}
          </div>
          <div className="sub">Hafta bitmedi; bunlar ilerleme göstergesidir, eksik değil.</div>
        </div>
      )}

      {idle.length > 0 && worked.length > 0 && (
        <div className="sub">{isWeek ? 'Bu hafta ve geçen hafta çalışmayan' : 'Çalışmayan'}: {idle.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
      )}
      <div className="sub">
        Birincil kas 1, yardımcı kas 0,5 set sayılır; ısınma seti sayılmaz. Varsayım: haftada kas başına {WEEKLY_TARGET_SETS} set; kesin hedef değil, yaklaşık bir ölçüdür.
        {isWeek && ' Hafta, ayarlardaki hafta başlangıcına göre hesaplanır.'}
      </div>
    </div>
  )
}
