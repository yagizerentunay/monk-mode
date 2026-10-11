import { useRef, useState } from 'react'
import { describeMerge } from '../lib/mergeBackup.ts'
import { importBackupWithReport } from '../store/backup.ts'
import { describeDropped } from '../store/sanitize.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { useStore } from '../store/useStore.ts'

/** Başka cihazdaki yedeği bu cihazın verisiyle birleştirir; hiçbir şey silinmez, çakışmada yerel kalır. */
export function MergeImportCard() {
  const mergeFrom = useStore((s) => s.mergeFrom)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { state: incoming, report: sanitized } = importBackupWithReport(await file.text())
      // Kopya, birleştirme state'i değiştirmeden önce (çağrı anında) alınır.
      void snapshotNow('Birleştirmeden önce')
      const report = mergeFrom(incoming)
      const skipped = describeDropped(sanitized)
      // describeMerge nokta ile biter; bozuk kayıt notu aynı cümleye girsin.
      const merged = describeMerge(report).replace(/.$/, '')
      setMessage(`Birleştirildi: ${merged}${skipped ? `; ${skipped}` : ''}.`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="card stack mergecard">
      <div className="eyebrow">Cihazlar arası</div>
      <h2>Yedekle birleştir</h2>
      <p className="sub" style={{ margin: 0 }}>
        Başka cihazdaki yedeği bu cihazdaki verilerle birleştirir; hiçbir şey silinmez. Aynı antrenman iki
        tarafta farklıysa buradaki korunur.
      </p>
      <button className="btn block" onClick={() => fileRef.current?.click()}>Yedekle birleştir</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
