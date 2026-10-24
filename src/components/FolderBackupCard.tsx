import { useEffect, useState } from 'react'
import { labels, t } from '../i18n/index.ts'
import { formatDateTime } from '../lib/calendar.ts'
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

const RESULT_TEXT = labels<Exclude<FolderResult, 'skipped'>>({
  saved: 'folder.saved',
  'needs-permission': 'folder.noPermission',
  failed: 'folder.failed',
})

const resultText = (r: FolderResult | 'cancelled'): string | null =>
  r === 'skipped' || r === 'cancelled' ? null : r === 'saved' ? `✓ ${RESULT_TEXT[r]}` : RESULT_TEXT[r]

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
    setMessage(resultText(result))
    await refresh()
  }

  return (
    <div className="card stack">
      <div className="eyebrow">{t('folder.title')}</div>
      <p className="sub" style={{ margin: 0 }}>
        {t('folder.hint', { n: KEEP_FILES })}
      </p>
      {status ? (
        <>
          <div className="row between">
            <span>{t('folder.folder')}</span>
            <span className="sub" style={{ margin: 0 }}>{status.name}</span>
          </div>
          <div className="row between">
            <span>{t('folder.last')}</span>
            <span className="sub" style={{ margin: 0 }}>
              {status.lastAt ? formatDateTime(status.lastAt) : t('folder.notYet')}
            </span>
          </div>
          <div className="row between">
            <span>{t('folder.permission')}</span>
            <span className="sub" style={{ margin: 0 }}>
              {status.permission === 'granted' ? t('folder.granted') : t('folder.needed')}
            </span>
          </div>
          <button className="btn block" disabled={busy} onClick={() => void run(() => backupToFolder({ ask: true }))}>
            {t('folder.backupNow')}
          </button>
          <div className="row">
            <button className="btn small grow" disabled={busy} onClick={() => void run(chooseFolder)}>
              {t('folder.change')}
            </button>
            <button
              className="btn small grow"
              disabled={busy}
              onClick={() => void removeFolder().then(() => { setMessage(t('folder.removed')); return refresh() })}
            >
              {t('common.close')}
            </button>
          </div>
        </>
      ) : (
        <button className="btn block" disabled={busy} onClick={() => void run(chooseFolder)}>
          {t('folder.choose')}
        </button>
      )}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
