import { useEffect, useMemo, useState } from 'react'
import { backupStatus, SNOOZE_DAYS } from '../lib/backupReminder.ts'
import { shareBackup } from '../store/downloadBackup.ts'
import { backupToFolder, folderStatus } from '../store/folderBackup.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Ana sayfada, veri yedekten beri değişmiş ve süre dolmuşsa görünen hatırlatma. Veri yalnızca bu
 * tarayıcıda durduğu için yedeksiz tarayıcı verisi silinirse her şey kaybolur.
 */
export function BackupReminder() {
  const workouts = useStore((s) => s.workouts)
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const bodyweight = useStore((s) => s.bodyweight)
  const customEx = useStore((s) => s.customEx)
  const settings = useStore((s) => s.settings)
  const snoozeBackup = useStore((s) => s.snoozeBackup)
  const [now] = useState(() => Date.now())
  const [done, setDone] = useState(false)
  const [hasFolder, setHasFolder] = useState(false)

  // Klasöre yedek açıksa (izni düşmüş olabilir) birincil eylem klasöre yedekle olur.
  useEffect(() => {
    void folderStatus().then((s) => setHasFolder(s !== null)).catch(() => undefined)
  }, [])

  const status = useMemo(
    () => backupStatus({ workouts, routines, week, bodyweight, customEx, settings }, now),
    [workouts, routines, week, bodyweight, customEx, settings, now],
  )

  if (done) {
    return <div className="card banner ok" role="status">✓ Yedek alındı.</div>
  }
  if (!status.due) return null

  return (
    <div className="card banner stack" role="status">
      <div>
        <b className="banner-title">⚠ Verini yedekle</b>
        <div className="sub">
          {status.never
            ? `Hiç yedek almadın; ${workouts.length} antrenman yalnızca bu tarayıcıda duruyor.`
            : `Son yedeğin ${status.days} gün önce; o günden beri yeni kayıtların yedeklenmedi.`}
        </div>
      </div>
      <div className="row">
        {hasFolder && (
          <button
            className="btn primary small grow"
            onClick={() => void backupToFolder({ ask: true }).then((r) => setDone(r === 'saved'))}
          >
            Klasöre yedekle
          </button>
        )}
        <button
          className={`btn small grow${hasFolder ? '' : ' primary'}`}
          onClick={() => void shareBackup().then((r) => setDone(r !== 'cancelled'))}
        >
          Yedeği kaydet
        </button>
        <button className="btn small grow" onClick={() => snoozeBackup(Date.now())}>
          {SNOOZE_DAYS} gün sonra hatırlat
        </button>
      </div>
    </div>
  )
}
