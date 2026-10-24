import { useMemo, useState } from 'react'
import { backupStatus } from '../lib/backupReminder.ts'
import { shareBackup, type SaveResult } from '../store/downloadBackup.ts'
import { useStore } from '../store/useStore.ts'

const DONE_TEXT: Record<Exclude<SaveResult, 'cancelled'>, string> = {
  shared: '✓ Yedek kaydedildi.',
  downloaded: '✓ Yedek indirildi.',
}

/**
 * Antrenman özetinde, yedek zamanı gelmişse (Ayarlar'daki hatırlatma süresi; ana sayfa hatırlatmasıyla
 * aynı kural) tek dokunuşla dışa yedek. Antrenman yeni bittiği için veri en değerli anında yedeklenir.
 */
export function BackupNudge() {
  const workouts = useStore((s) => s.workouts)
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const bodyweight = useStore((s) => s.bodyweight)
  const measurements = useStore((s) => s.measurements)
  const customEx = useStore((s) => s.customEx)
  const settings = useStore((s) => s.settings)
  const [now] = useState(() => Date.now())
  const [result, setResult] = useState<SaveResult | null>(null)
  const [hidden, setHidden] = useState(false)

  const due = useMemo(
    () => backupStatus({ workouts, routines, week, bodyweight, measurements, customEx, settings }, now).due,
    [workouts, routines, week, bodyweight, measurements, customEx, settings, now],
  )

  if (result && result !== 'cancelled') return <div className="card banner ok" role="status">{DONE_TEXT[result]}</div>
  if (hidden || (!due && !result)) return null

  return (
    <div className="card banner stack" role="status">
      <div>
        <b className="banner-title">Yedeğini al</b>
        <div className="sub">
          {workouts.length} antrenman yalnızca bu tarayıcıda. Dosyalar'a, buluta ya da kendine mesaj olarak kaydet.
        </div>
      </div>
      <div className="row">
        <button className="btn primary small grow" onClick={() => void shareBackup().then(setResult)}>
          Yedeği kaydet
        </button>
        <button className="btn small grow" onClick={() => setHidden(true)}>
          Şimdi değil
        </button>
      </div>
    </div>
  )
}
