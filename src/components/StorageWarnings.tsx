import { t } from '../i18n/index.ts'
import { downloadBackup, downloadRaw } from '../store/downloadBackup.ts'
import { dismissCorrupt, dismissSanitized, useStorageStatus } from '../store/persist.ts'

/**
 * Uygulama kabuğunda, her sayfada görünen depolama uyarıları: kayıtlı veri okunamadıysa ve kayıt
 * yazılamıyorsa; ayrıca okunabilen ama bazı kayıtları bozuk olan veri için (bozuklar atlandı, ham veri ayrı saklandı). Hepsi de kullanıcı veri kaybetmeden önce bilsin diye kalıcıdır (kendiliğinden kapanmaz).
 */
export function StorageWarnings() {
  const corrupt = useStorageStatus((s) => s.corrupt)
  const sanitized = useStorageStatus((s) => s.sanitized)
  const blocked = useStorageStatus((s) => s.blocked)
  const saveFailed = useStorageStatus((s) => s.saveFailed)

  if (!corrupt && !sanitized && !saveFailed) return null

  return (
    <div className="stack storage-warnings">
      {corrupt && (
        <div className="card banner stack" role="alert">
          <div>
            <b className="banner-title">⚠ {t('storage.corruptTitle')}</b>
            <div className="sub">
              {blocked ? t('storage.corruptBlocked') : t('storage.corrupt')}
            </div>
          </div>
          <div className="row">
            <button className="btn primary small grow" onClick={() => downloadRaw(corrupt.raw)}>
              {t('storage.downloadRaw')}
            </button>
            <button className="btn small grow" onClick={dismissCorrupt}>
              {blocked ? t('storage.continue') : t('common.close')}
            </button>
          </div>
        </div>
      )}
      {sanitized && (
        <div className="card banner stack" role="alert">
          <div>
            <b className="banner-title">⚠ {t('storage.sanitizedTitle')}</b>
            <div className="sub">
              {blocked
                ? t('storage.sanitizedBlocked', { n: sanitized.dropped })
                : t('storage.sanitized', { n: sanitized.dropped })}
              {!blocked && sanitized.repaired > 0 && ` ${t('storage.repaired', { n: sanitized.repaired })}`}
            </div>
          </div>
          <div className="row">
            <button className="btn primary small grow" onClick={() => downloadRaw(sanitized.raw)}>
              {t('storage.downloadRaw')}
            </button>
            <button className="btn small grow" onClick={dismissSanitized}>
              {blocked ? t('storage.continue') : t('common.close')}
            </button>
          </div>
        </div>
      )}
      {saveFailed && (
        <div className="card banner stack" role="alert">
          <div>
            <b className="banner-title">⚠ {t('storage.saveFailedTitle')}</b>
            <div className="sub">
              {t('storage.saveFailed')}
            </div>
          </div>
          <button className="btn small" onClick={() => downloadBackup()}>
            {t('storage.downloadBackup')}
          </button>
        </div>
      )}
    </div>
  )
}
