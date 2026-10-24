import { useEffect, useMemo, useState } from 'react'
import { t } from '../i18n/index.ts'
import { encodeQr } from '../lib/qr.ts'
import { encodeRoutine, shareUrl, ShareError } from '../lib/routineShare.ts'
import type { Routine } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { QrCode } from './QrCode.tsx'

type LinkState = { url: string } | { error: string } | null

/**
 * "Rutini paylaş" çekmecesinin içeriği: link (Paylaş menüsü, yoksa panoya kopyalama) ve QR. Link yalnız
 * rutinin kendisini ve kullandığı özel egzersizleri taşır; antrenman geçmişi ve ayarlar gitmez.
 */
export function ShareRoutine({ routine }: { routine: Routine }) {
  const customEx = useStore((s) => s.customEx)
  const [link, setLink] = useState<LinkState>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    encodeRoutine(routine, customEx)
      .then((payload) => alive && setLink({ url: shareUrl(payload) }))
      .catch((e: unknown) => alive && setLink({ error: e instanceof ShareError ? e.message : t('share.createFailed') }))
    return () => {
      alive = false
    }
  }, [routine, customEx])

  const url = link && 'url' in link ? link.url : null
  const matrix = useMemo(() => (url ? encodeQr(url) : null), [url])
  const canShare = typeof navigator.share === 'function'

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setStatus(t('share.copied'))
    } catch {
      setStatus(t('share.copyFailed'))
    }
  }

  const share = async () => {
    if (!url) return
    try {
      await navigator.share({ title: t('share.title', { name: routine.name }), url })
    } catch (e) {
      // Kullanıcı menüyü kapattıysa sessiz kal; başka bir hata olursa panoya kopyalamayı dene.
      if (!(e instanceof DOMException && e.name === 'AbortError')) await copy()
    }
  }

  if (link && 'error' in link) return <p className="warntext" role="alert">{link.error}</p>
  if (!url) return <p className="sub">{t('share.preparing')}</p>

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        {t('share.hint')}
      </p>
      {matrix ? (
        <QrCode matrix={matrix} label={t('share.qrAria', { name: routine.name })} />
      ) : (
        <p className="warntext" role="status">{t('share.qrTooBig')}</p>
      )}
      <input className="input" readOnly aria-label={t('share.linkAria')} value={url} onFocus={(e) => e.currentTarget.select()} />
      {canShare ? (
        <>
          <button className="btn primary block" onClick={share}>{t('shareCard.share')}</button>
          <button className="btn block" onClick={copy}>{t('share.copyLink')}</button>
        </>
      ) : (
        <button className="btn primary block" onClick={copy}>{t('share.copyLink')}</button>
      )}
      {status && <p className="sub" role="status" style={{ margin: 0 }}>{status}</p>}
    </div>
  )
}
