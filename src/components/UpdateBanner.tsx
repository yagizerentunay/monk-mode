import { useState } from 'react'
import { t } from '../i18n/index.ts'
import { useUpdateAvailable } from '../lib/updateCheck.ts'

/**
 * Yeni sürüm yayınlandıysa üstte görünen bant. Yenileme güvenli: tüm veri (devam eden antrenman ve
 * dinlenme sayacı dahil) tarayıcıda kayıtlı, sayfa yeniden açılınca kaldığı yerden sürer.
 */
export function UpdateBanner() {
  const update = useUpdateAvailable()
  const [later, setLater] = useState(false)
  if (!update || later) return null

  return (
    <div className="card banner stack update-banner" role="status">
      <div>
        <b className="banner-title">{t('update.title')}{update.version ? ` (v${update.version})` : ''}</b>
        <div className="sub">{t('update.body')}</div>
      </div>
      <div className="row">
        <button className="btn primary small grow" onClick={() => location.reload()}>
          {t('diag.refresh')}
        </button>
        <button className="btn small grow" onClick={() => setLater(true)}>
          {t('update.later')}
        </button>
      </div>
    </div>
  )
}
