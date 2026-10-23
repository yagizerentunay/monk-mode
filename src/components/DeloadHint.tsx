import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { blockStatus, planDeloadThisWeek, withoutDeloadWeeks } from '../lib/block.ts'
import { deloadCutText, deloadRirText, deloadSnoozeUntil, detectDeload, isDeloadSnoozed } from '../lib/deload.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'

/** Kartta en fazla kaç egzersiz adı sayılır. */
const MAX_NAMES = 3

/**
 * Ana sayfada, birden fazla egzersizde son iki seans üst üste belirgin düşmüşse görünen yumuşak
 * toparlanma molası önerisi. Toparlanma ölçülemediği için yalnızca öneridir; kendiliğinden hiçbir şeyi
 * değiştirmez. Planlı deload haftasında görünmez (plan zaten molayı içeriyor) ve planlı deload
 * haftalarındaki bilinçli hafif seanslar düşüş sayılmaz (bkz. lib/block.ts withoutDeloadWeeks).
 */
export function DeloadHint() {
  const { workouts, block, pastBlocks } = useStore(
    useShallow((s) => ({ workouts: s.workouts, block: s.block, pastBlocks: s.pastBlocks })),
  )
  const snoozedUntil = useStore((s) => s.settings.deloadSnoozedUntil)
  const weekStart = useStore((s) => s.settings.weekStart)
  const [now] = useState(() => Date.now())
  const today = useMemo(() => new Date(now), [now])
  const hint = useMemo(() => {
    const blocks = block ? [block, ...pastBlocks] : pastBlocks
    return detectDeload(withoutDeloadWeeks(workouts, blocks, weekStart), now)
  }, [workouts, block, pastBlocks, weekStart, now])

  if (!hint || isDeloadSnoozed(snoozedUntil, now)) return null
  const status = block ? blockStatus(block, today, weekStart) : undefined
  if (status?.deload) return null
  // Henüz başlamamış blok varsa planı bozmamak için "planla" eylemi gösterilmez.
  const canPlan = planDeloadThisWeek(block, today, weekStart, '') !== undefined
  return <DeloadCard exIds={hint.exercises} today={today} canPlan={canPlan} inBlock={status?.phase === 'running'} />
}

function DeloadCard({ exIds, today, canPlan, inBlock }: { exIds: string[]; today: Date; canPlan: boolean; inBlock: boolean }) {
  const { byId } = useExercises()
  const setSettings = useStore((s) => s.setSettings)
  const planDeload = useStore((s) => s.planDeloadThisWeek)
  const names = exIds.slice(0, MAX_NAMES).map((id) => byId.get(id)?.name ?? id)
  const more = exIds.length - names.length

  return (
    <div className="card banner stack" role="status">
      <div>
        <b className="banner-title">Toparlanma molası?</b>
        <div className="sub">
          Son iki antrenmanda {names.join(', ')}
          {more > 0 ? ` ve ${more} egzersizde daha` : ''} performansın belirgin düştü. Önce uyku, beslenme ve dinlenmeyi kontrol et;
          düşüş sürerse 5–7 gün boyunca setleri {deloadCutText()} azaltıp RIR {deloadRirText()} ile çalışmayı düşünebilirsin.
        </div>
        {canPlan && (
          <div className="sub">
            {inBlock
              ? 'Planlarsan bloğundaki deload haftası bu haftaya taşınır.'
              : 'Planlarsan bu hafta deload ile başlayan yeni bir blok kurulur; Plan sekmesinden düzenleyebilirsin.'}
          </div>
        )}
      </div>
      <div className="row">
        {canPlan && (
          <button className="btn small primary grow" onClick={() => planDeload(today)}>
            Deload'u bu haftaya planla
          </button>
        )}
        <button className="btn small grow" onClick={() => setSettings({ deloadSnoozedUntil: deloadSnoozeUntil(Date.now()) })}>
          Şimdi değil
        </button>
      </div>
    </div>
  )
}
