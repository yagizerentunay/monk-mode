import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { t } from '../i18n/index.ts'
import { describeMerge } from '../lib/mergeBackup.ts'
import { takeSharedBackup } from '../lib/sharedFile.ts'
import { previewTransfer, transferPlatform, type TransferPreview } from '../lib/transfer.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { shareBackup } from '../store/downloadBackup.ts'
import { snapshot, useStore } from '../store/useStore.ts'
import { ChipRow } from './ChipRow.tsx'

type Tab = 'send' | 'receive'

const SEND_STEP = { ios: 'transfer.stepIos', android: 'transfer.stepAndroid', other: 'transfer.stepOther' } as const

/** Cümle sonundaki noktayı atar; aynı cümleye "; N bozuk kayıt atlandı" notu eklenebilsin. */
const withoutDot = (s: string): string => s.replace(/.$/, '')

/**
 * Başka cihaza aktarım: Gönder, yedeği (girintisiz, küçük) paylaşım menüsüne ya da indirmeye verir; Al, gelen
 * dosyayı önce önizler (ne eklenecek, ne zaten var, ne çakışıyor), onayla birleştirir. Hiçbir şey silinmez,
 * çakışmada yerel kalır (lib/mergeBackup.ts). Android'de paylaşım menüsünden gelen dosya da buraya düşer
 * (`#/settings?aktarim=al`, bkz. lib/sharedFile.ts).
 */
export function TransferCard() {
  const mergeFrom = useStore((s) => s.mergeFrom)
  const [params, setParams] = useSearchParams()
  const cardRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>(params.get('aktarim') === 'al' ? 'receive' : 'send')
  const [preview, setPreview] = useState<(TransferPreview & { file: string }) | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const platform = transferPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent)

  const load = async (file: File | null | undefined) => {
    if (!file) return
    setMessage(null)
    setPreview(null)
    try {
      setPreview({ ...previewTransfer(await file.text(), snapshot(useStore.getState())), file: file.name })
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Paylaşım menüsünden gelindiyse Al sekmesi açılır, dosya önizlemeye alınır ve adres temizlenir.
  // Dosya yalnız bir kez alınabilir (takeSharedBackup siler); ikinci çağrı null döner ve zararsızdır.
  useEffect(() => {
    if (params.get('aktarim') !== 'al') return
    setTab('receive')
    cardRef.current?.scrollIntoView?.({ block: 'start' })
    void takeSharedBackup().then(load)
    setParams(
      (prev) => {
        prev.delete('aktarim')
        return prev
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız ilk açılışta çalışır
  }, [])

  const send = async () => {
    setMessage(null)
    const r = await shareBackup(new Date(), { compact: true })
    if (r === 'shared') setMessage(t('transfer.sent'))
    else if (r === 'downloaded') setMessage(t('transfer.downloaded'))
  }

  const apply = () => {
    if (!preview) return
    // Kopya, birleştirme state'i değiştirmeden önce (çağrı anında) alınır.
    void snapshotNow(t('snapshot.beforeMerge'))
    const report = mergeFrom(preview.incoming)
    setMessage(t('merge.done', { merged: withoutDot(describeMerge(report)), skipped: preview.dropped ? `; ${preview.dropped}` : '' }))
    setPreview(null)
  }

  const pick = (next: Tab) => {
    setTab(next)
    setMessage(null)
  }

  return (
    <div ref={cardRef} className="card stack mergecard">
      <div className="eyebrow">{t('merge.eyebrow')}</div>
      <h2>{t('transfer.title')}</h2>
      <ChipRow>
        {(['send', 'receive'] as const).map((k) => (
          <button key={k} className={`chip${tab === k ? ' on' : ''}`} aria-pressed={tab === k} onClick={() => pick(k)}>
            {t(k === 'send' ? 'transfer.send' : 'transfer.receive')}
          </button>
        ))}
      </ChipRow>

      {tab === 'send' ? (
        <>
          <p className="sub" style={{ margin: 0 }}>{t('transfer.sendHint')}</p>
          <button className="btn block" onClick={() => void send()}>{t('transfer.sendButton')}</button>
          <p className="sub" style={{ margin: 0 }}>{t(SEND_STEP[platform])}</p>
          <p className="sub" style={{ margin: 0 }}>{t('transfer.privacy')}</p>
        </>
      ) : (
        <>
          <p className="sub" style={{ margin: 0 }}>{t('transfer.receiveHint')}</p>
          <p className="sub" style={{ margin: 0 }}>{t('merge.hint')}</p>
          {platform === 'android' && <p className="sub" style={{ margin: 0 }}>{t('transfer.receiveAndroid')}</p>}
          <button className="btn block" onClick={() => fileRef.current?.click()}>{t('transfer.pick')}</button>
          {preview && (
            <div className="stack" role="status">
              <p style={{ margin: 0 }}>
                {t('transfer.preview', {
                  file: preview.file,
                  merged: withoutDot(preview.summary),
                  skipped: preview.dropped ? `; ${preview.dropped}` : '',
                })}
              </p>
              {preview.hasNew ? (
                <div className="row">
                  <button className="btn primary grow" onClick={apply}>{t('transfer.apply')}</button>
                  <button className="btn grow" onClick={() => setPreview(null)}>{t('transfer.cancel')}</button>
                </div>
              ) : (
                <button className="btn block" onClick={() => setPreview(null)}>{t('transfer.close')}</button>
              )}
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void load(e.target.files?.[0])}
      />
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
