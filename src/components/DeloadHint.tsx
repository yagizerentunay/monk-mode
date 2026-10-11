import { useMemo, useState } from 'react'
import { deloadSnoozeUntil, detectDeload, isDeloadSnoozed } from '../lib/deload.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'

/** Kartta en fazla kaç egzersiz adı sayılır. */
const MAX_NAMES = 3

/**
 * Ana sayfada, birden fazla egzersizde son iki seans üst üste belirgin düşmüşse görünen yumuşak
 * toparlanma molası önerisi. Toparlanma ölçülemediği için yalnızca öneridir; hiçbir şeyi değiştirmez.
 */
export function DeloadHint() {
  const workouts = useStore((s) => s.workouts)
  const snoozedUntil = useStore((s) => s.settings.deloadSnoozedUntil)
  const [now] = useState(() => Date.now())
  const hint = useMemo(() => detectDeload(workouts, now), [workouts, now])

  if (!hint || isDeloadSnoozed(snoozedUntil, now)) return null
  return <DeloadCard exIds={hint.exercises} />
}

function DeloadCard({ exIds }: { exIds: string[] }) {
  const { byId } = useExercises()
  const setSettings = useStore((s) => s.setSettings)
  const names = exIds.slice(0, MAX_NAMES).map((id) => byId.get(id)?.name ?? id)
  const more = exIds.length - names.length

  return (
    <div className="card banner stack" role="status">
      <div>
        <b className="banner-title">Toparlanma molası?</b>
        <div className="sub">
          Son iki antrenmanda {names.join(', ')}
          {more > 0 ? ` ve ${more} egzersizde daha` : ''} performansın belirgin düştü. Önce uyku, beslenme ve dinlenmeyi kontrol et;
          düşüş sürerse 5–7 gün boyunca setleri %40–50 azaltıp RIR 4–5 ile çalışmayı düşünebilirsin.
        </div>
      </div>
      <div className="row">
        <button className="btn small grow" onClick={() => setSettings({ deloadSnoozedUntil: deloadSnoozeUntil(Date.now()) })}>
          Şimdi değil
        </button>
      </div>
    </div>
  )
}
