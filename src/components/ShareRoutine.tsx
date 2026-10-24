import { useEffect, useMemo, useState } from 'react'
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
      .catch((e: unknown) => alive && setLink({ error: e instanceof ShareError ? e.message : 'Paylaşım linki oluşturulamadı.' }))
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
      setStatus('Link panoya kopyalandı.')
    } catch {
      setStatus('Kopyalanamadı; linki aşağıdan seçip kopyala.')
    }
  }

  const share = async () => {
    if (!url) return
    try {
      await navigator.share({ title: `monk-mode rutini: ${routine.name}`, url })
    } catch (e) {
      // Kullanıcı menüyü kapattıysa sessiz kal; başka bir hata olursa panoya kopyalamayı dene.
      if (!(e instanceof DOMException && e.name === 'AbortError')) await copy()
    }
  }

  if (link && 'error' in link) return <p className="warntext" role="alert">{link.error}</p>
  if (!url) return <p className="sub">Link hazırlanıyor…</p>

  return (
    <div className="stack">
      <p className="sub" style={{ margin: 0 }}>
        Link rutini (egzersizler, set/tekrar, ağırlık, dinlenme) taşır; antrenman geçmişin ve ayarların gitmez. Açan
        kişi önizleyip kendi rutinlerine ekler.
      </p>
      {matrix ? (
        <QrCode matrix={matrix} label={`${routine.name} rutininin paylaşım QR kodu`} />
      ) : (
        <p className="warntext" role="status">Bu rutin QR koda sığmayacak kadar büyük; linki paylaş ya da kopyala.</p>
      )}
      <input className="input" readOnly aria-label="Paylaşım linki" value={url} onFocus={(e) => e.currentTarget.select()} />
      {canShare ? (
        <>
          <button className="btn primary block" onClick={share}>Paylaş</button>
          <button className="btn block" onClick={copy}>Linki kopyala</button>
        </>
      ) : (
        <button className="btn primary block" onClick={copy}>Linki kopyala</button>
      )}
      {status && <p className="sub" role="status" style={{ margin: 0 }}>{status}</p>}
    </div>
  )
}
