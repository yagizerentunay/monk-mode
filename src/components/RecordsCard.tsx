import { useMemo, useState } from 'react'
import { isRecentRecord, personalRecords, RECENT_RECORD_DAYS } from '../lib/records.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'
import { BottomSheet } from './BottomSheet.tsx'
import { ExerciseHistory } from './ExerciseHistory.tsx'
import { RecordsList } from './RecordsList.tsx'

/** Analiz'de her egzersizin kişisel rekorları: en iyi tahmini 1RM ve en ağır set, en yeni rekor önde. */
export function RecordsCard() {
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const { byId } = useExercises()
  const [today] = useState(() => new Date())
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const records = useMemo(() => personalRecords(workouts), [workouts])
  if (records.length === 0) return null

  const nameOf = (id: string) => byId.get(id)?.name ?? id
  const recentCount = records.filter((r) => isRecentRecord(r.d, today)).length

  return (
    <div className="card stack">
      <div>
        <div className="eyebrow">Kişisel rekorlar</div>
        <h2 style={{ margin: 0 }}>Rekorlar</h2>
        <div className="sub">
          {records.length} egzersiz · son {RECENT_RECORD_DAYS} günde {recentCount} yeni rekor
        </div>
      </div>
      <RecordsList
        records={records}
        nameOf={nameOf}
        unit={unit}
        today={today}
        showAll={showAll}
        onToggleAll={() => setShowAll((v) => !v)}
        onOpen={setOpenId}
      />
      <BottomSheet open={openId !== null} onClose={() => setOpenId(null)} title={openId ? nameOf(openId) : undefined}>
        {openId && <ExerciseHistory exId={openId} />}
      </BottomSheet>
    </div>
  )
}
