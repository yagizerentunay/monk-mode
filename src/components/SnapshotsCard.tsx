import { useEffect, useState } from 'react'
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
    const when = new Date(s.at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
    if (!confirm(`Tüm veriler ${when} kopyasıyla değiştirilsin mi? Şu anki hâlin de önce kopyalanır.`)) return
    try {
      const state = await loadSnapshot(s.at)
      await snapshotNow('Geri yüklemeden önce')
      replaceAll(state)
      setMessage(`Geri yüklendi: ${state.workouts.length} antrenman.`)
    } catch (e) {
      setMessage((e as Error).message)
    }
    refresh()
  }

  return (
    <div className="card stack">
      <div className="eyebrow">Otomatik kopyalar</div>
      <p className="sub" style={{ margin: 0 }}>
        Her antrenman bitince ve yedek yükleme ya da sıfırlama gibi işlemlerden önce verinin kopyası bu tarayıcıda
        saklanır (son {MAX_SNAPSHOTS}). Yanlışlıkla silmeye karşı korur; tarayıcı verisi silinirse bunlar da gider,
        dışa yedeğin yerini tutmaz.
      </p>
      {list && list.length === 0 && <p className="sub" style={{ margin: 0 }}>Henüz kopya yok.</p>}
      {list?.map((s) => (
        <div key={s.at} className="row between">
          <div>
            <div>{new Date(s.at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            <div className="sub" style={{ margin: 0 }}>{s.reason} · {s.workouts} antrenman</div>
          </div>
          <button className="btn small" onClick={() => void restore(s)}>Geri yükle</button>
        </div>
      ))}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
