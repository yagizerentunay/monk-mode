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
            <b className="banner-title">⚠ Kayıtlı verin okunamadı</b>
            <div className="sub">
              {blocked
                ? 'Tarayıcıdaki veri bozuk ve ayrı bir kopyası yazılamadı (depolama dolu olabilir). Bozuk veri şimdilik dokunulmadan duruyor; yeni kayıtların diske yazılmıyor. Önce ham veriyi indir; devam edersen bozuk veri silinir.'
                : 'Tarayıcıdaki veri bozuk olduğu için yüklenemedi ve uygulama boş başladı. Ham veri silinmedi: bu tarayıcıda ayrı bir kopya olarak saklandı. Kurtarmak ya da göndermek için dosya olarak indirebilirsin.'}
            </div>
          </div>
          <div className="row">
            <button className="btn primary small grow" onClick={() => downloadRaw(corrupt.raw)}>
              Ham veriyi indir
            </button>
            <button className="btn small grow" onClick={dismissCorrupt}>
              {blocked ? 'İndirdim, devam et' : 'Kapat'}
            </button>
          </div>
        </div>
      )}
      {sanitized && (
        <div className="card banner stack" role="alert">
          <div>
            <b className="banner-title">⚠ Bozuk kayıtlar atlandı</b>
            <div className="sub">
              {blocked
                ? `Kayıtlı verinde ${sanitized.dropped} bozuk kayıt vardı ve ham verinin ayrı bir kopyası yazılamadı (depolama dolu olabilir). Yeni kayıtların şimdilik diske yazılmıyor. Önce ham veriyi indir; devam edersen bozuk kayıtlar kalıcı olarak kaybolur.`
                : `Kayıtlı verinde ${sanitized.dropped} bozuk kayıt vardı; atlandı. Ham veri ayrı saklandı.`}
              {!blocked && sanitized.repaired > 0 && ` ${sanitized.repaired} kayıt da otomatik düzeltildi.`}
            </div>
          </div>
          <div className="row">
            <button className="btn primary small grow" onClick={() => downloadRaw(sanitized.raw)}>
              Ham veriyi indir
            </button>
            <button className="btn small grow" onClick={dismissSanitized}>
              {blocked ? 'İndirdim, devam et' : 'Kapat'}
            </button>
          </div>
        </div>
      )}
      {saveFailed && (
        <div className="card banner stack" role="alert">
          <div>
            <b className="banner-title">⚠ Veriler kaydedilemiyor</b>
            <div className="sub">
              Depolama dolu ya da kapalı (gizli mod olabilir). Sayfayı kapatırsan son değişikliklerin kaybolabilir.
              Ayarlar'dan yedek indirmeni öneririm.
            </div>
          </div>
          <button className="btn small" onClick={() => downloadBackup()}>
            Yedeği indir
          </button>
        </div>
      )}
    </div>
  )
}
