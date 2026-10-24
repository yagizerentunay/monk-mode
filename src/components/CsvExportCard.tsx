import { useEffect, useState } from 'react'
import { t } from '../i18n/index.ts'
import { loadExercises } from '../lib/exercises.ts'
import { exportCsv, exportMeasurementsCsv, type SaveResult } from '../store/downloadBackup.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Ayarlar'da antrenman geçmişini Türkçe Excel'in doğrudan açtığı CSV olarak dışa aktarır. Vücut ölçüleri
 * (kaydı varsa) sütunları farklı olduğu için ayrı bir dosyaya gider.
 */
export function CsvExportCard() {
  const count = useStore((s) => s.workouts.length)
  const measureCount = useStore((s) => s.measurements.length)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Kütüphane önceden yüklensin: dokunuşta beklenirse iOS paylaşım menüsünün istediği kullanıcı jesti düşebilir.
  useEffect(() => {
    loadExercises().catch(() => {})
  }, [])

  const save = async (run: () => Promise<SaveResult>, what: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await run()
      if (r !== 'cancelled') setMessage(r === 'shared' ? t('csv.saved', { what }) : t('csv.downloaded', { what }))
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <div className="eyebrow">{t('csv.title')}</div>
      <p className="sub" style={{ margin: 0 }}>
        {t('csv.hint')}
      </p>
      <button className="btn block" disabled={count === 0 || busy} onClick={() => void save(exportCsv, t('count.workouts', { n: count }))}>
        {t('csv.workouts')}
      </button>
      {measureCount > 0 && (
        <button
          className="btn block"
          disabled={busy}
          onClick={() => void save(exportMeasurementsCsv, t('count.measurements', { n: measureCount }))}
        >
          {t('csv.measurements')}
        </button>
      )}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
