import { useState } from 'react'
import { exportCsv } from '../store/downloadBackup.ts'
import { useStore } from '../store/useStore.ts'

/** Ayarlar'da antrenman geçmişini Türkçe Excel'in doğrudan açtığı CSV olarak dışa aktarır. */
export function CsvExportCard() {
  const count = useStore((s) => s.workouts.length)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await exportCsv()
      if (r !== 'cancelled') setMessage(r === 'shared' ? `CSV kaydedildi: ${count} antrenman.` : `CSV indirildi: ${count} antrenman.`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div className="eyebrow">Excel için dışa aktar</div>
      <p className="sub" style={{ margin: 0 }}>
        Tamamlanan her set bir satır olur; noktalı virgül ayraçlı, virgül ondalıklı dosya Türkçe Excel'de çift tıklayınca doğru açılır.
        Yedeğin yerini tutmaz: geri yüklenemez.
      </p>
      <button className="btn block" disabled={count === 0 || busy} onClick={() => void save()}>
        Antrenmanları CSV olarak kaydet
      </button>
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
