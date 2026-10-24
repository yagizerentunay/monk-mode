import { useEffect, useState } from 'react'
import { t } from '../i18n/index.ts'
import { formatDateTime } from '../lib/calendar.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { listSnapshots, loadSnapshot, MAX_SNAPSHOTS, type SnapshotMeta } from '../store/snapshots.ts'
import { useStore } from '../store/useStore.ts'

/** Ayarlar'da otomatik iç kopyaların listesi ve geri yükleme. */
export function SnapshotsCard() {
  const replaceAll = useStore((s) => s.replaceAll)
  const [list, setList] = useState<SnapshotMeta[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => {
    listSnapshots()
      .then(setList)
      .catch(() => setList([]))
  }
  useEffect(refresh, [])

  const restore = async (s: SnapshotMeta) => {
    if (!confirm(t('snapshots.confirm', { when: formatDateTime(s.at) }))) return
    try {
      const state = await loadSnapshot(s.at)
      await snapshotNow(t('snapshot.beforeSnapshotRestore'))
      replaceAll(state)
      setMessage(t('snapshots.restored', { workouts: t('count.workouts', { n: state.workouts.length }) }))
    } catch (e) {
      setMessage((e as Error).message)
    }
    refresh()
  }

  return (
    <div className="card stack">
      <div className="eyebrow">{t('snapshots.title')}</div>
      <p className="sub" style={{ margin: 0 }}>
        {t('snapshots.hint', { n: MAX_SNAPSHOTS })}
      </p>
      {list && list.length === 0 && <p className="sub" style={{ margin: 0 }}>{t('snapshots.empty')}</p>}
      {list?.map((s) => (
        <div key={s.at} className="row between">
          <div>
            <div>{formatDateTime(s.at)}</div>
            <div className="sub" style={{ margin: 0 }}>{s.reason} · {t('count.workouts', { n: s.workouts })}</div>
          </div>
          <button className="btn small" onClick={() => void restore(s)}>{t('snapshots.restore')}</button>
        </div>
      ))}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
