import { useEffect, useState } from 'react'
import { KEEP_FILES } from '../lib/folderBackup.ts'
import {
  backupToFolder,
  chooseFolder,
  folderBackupSupported,
  folderStatus,
  removeFolder,
  type FolderResult,
  type FolderStatus,
} from '../store/folderBackup.ts'

const RESULT_TEXT: Record<FolderResult | 'cancelled', string | null> = {
  saved: '✓ Klasöre yedeklendi.',
  skipped: null,
  cancelled: null,
  'needs-permission': 'Klasöre yazma izni verilmedi.',
  failed: 'Klasöre yazılamadı. Klasör silinmiş ya da taşınmış olabilir; yeniden seçmeyi dene.',
}

/**
 * Ayarlar'da klasöre otomatik yedek (yalnız masaüstü Chromium). Seçilen klasöre günde bir dosya yazılır;
 * klasör OneDrive/Drive/Dropbox gibi eşitlenen bir yerdeyse yedek kendiliğinden buluta da gider.
 */
export function FolderBackupCard() {
  const [status, setStatus] = useState<FolderStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    folderStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  useEffect(() => {
    void refresh()
  }, [])

  if (!folderBackupSupported()) return null

  const run = async (action: () => Promise<FolderResult | 'cancelled'>) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    setMessage(RESULT_TEXT[result])
    await refresh()
  }

  return (
    <div className="card stack">
      <div className="eyebrow">Klasöre otomatik yedek</div>
      <p className="sub" style={{ margin: 0 }}>
        Bir klasör seç; veri her değiştiğinde (antrenman bitince, uygulamadan çıkınca, açılışta) günde bir dosya
        olarak oraya yazılır, son {KEEP_FILES} gün tutulur. Klasör OneDrive, Drive ya da Dropbox ile eşitleniyorsa
        yedeğin buluta da gider. Tarayıcı yeniden başladığında izin istenebilir.
      </p>
      {status ? (
        <>
          <div className="row between">
            <span>Klasör</span>
            <span className="sub" style={{ margin: 0 }}>{status.name}</span>
          </div>
          <div className="row between">
            <span>Son klasör yedeği</span>
            <span className="sub" style={{ margin: 0 }}>
              {status.lastAt
                ? new Date(status.lastAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
                : 'henüz yok'}
            </span>
          </div>
          <div className="row between">
            <span>Yazma izni</span>
            <span className="sub" style={{ margin: 0 }}>
              {status.permission === 'granted' ? 'var' : 'gerekli (Şimdi yedekle ile ver)'}
            </span>
          </div>
          <button className="btn block" disabled={busy} onClick={() => void run(() => backupToFolder({ ask: true }))}>
            Şimdi yedekle
          </button>
          <div className="row">
            <button className="btn small grow" disabled={busy} onClick={() => void run(chooseFolder)}>
              Klasörü değiştir
            </button>
            <button
              className="btn small grow"
              disabled={busy}
              onClick={() => void removeFolder().then(() => { setMessage('Klasör yedeği kapatıldı. Klasördeki dosyalar silinmedi.'); return refresh() })}
            >
              Kapat
            </button>
          </div>
        </>
      ) : (
        <button className="btn block" disabled={busy} onClick={() => void run(chooseFolder)}>
          Klasör seç
        </button>
      )}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
