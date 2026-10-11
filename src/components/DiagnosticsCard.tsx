import { useState } from 'react'
import { restDoneAlert } from '../lib/alert.ts'
import { collectDiagnostics, diagnosticsReport, type DiagRow } from '../lib/diagnostics.ts'
import { useStore } from '../store/useStore.ts'

const MARK: Record<DiagRow['status'], string> = { ok: '✓', warn: '!', info: '·' }

/** Ayarlar'da cihaz tanılaması (bkz. lib/diagnostics.ts). Açılınca toplanır; hiçbir şeyi değiştirmez. */
export function DiagnosticsCard() {
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt)
  const [rows, setRows] = useState<DiagRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [fallback, setFallback] = useState<string | null>(null)

  const refresh = async () => {
    setBusy(true)
    setRows(await collectDiagnostics(__APP_VERSION__, lastBackupAt))
    setBusy(false)
  }

  const testSound = () => {
    // Dokunuşun içinde çalınır: iOS sesi ancak kullanıcı jestiyle açar. Sonra durum yeniden okunur.
    restDoneAlert()
    setTimeout(() => void refresh(), 800)
  }

  const copy = async () => {
    if (!rows) return
    const text = diagnosticsReport(rows, navigator.userAgent)
    try {
      await navigator.clipboard.writeText(text)
      setCopied('Rapor kopyalandı.')
      setFallback(null)
    } catch {
      setCopied('Kopyalanamadı; aşağıdaki metni seçip kopyala.')
      setFallback(text)
    }
  }

  return (
    <div className="card stack diagnostics">
      <div className="eyebrow">Tanılama</div>
      <p className="sub" style={{ margin: 0 }}>
        Bu cihazda çevrimdışı çalışma, kalıcı depolama, paylaşım ve ses gibi özelliklerin gerçekten çalışıp
        çalışmadığını gösterir. Hiçbir şeyi değiştirmez.
      </p>
      {rows === null ? (
        <button className="btn block" disabled={busy} onClick={() => void refresh()}>
          Tanılamayı göster
        </button>
      ) : (
        <>
          <ul className="diaglist">
            {rows.map((r) => (
              <li key={r.label} className={`row between diag-${r.status}`}>
                <span>
                  <span className="diagmark" aria-hidden="true">{MARK[r.status]}</span> {r.label}
                </span>
                <span className="sub diagvalue">{r.value}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button className="btn small grow" onClick={testSound}>Test sesi çal</button>
            <button className="btn small grow" disabled={busy} onClick={() => void refresh()}>Yenile</button>
          </div>
          <button className="btn primary block" onClick={() => void copy()}>Raporu kopyala</button>
          {copied && <p className="sub" role="status" style={{ margin: 0 }}>{copied}</p>}
          {fallback && (
            <textarea className="input" readOnly rows={6} value={fallback} onFocus={(e) => e.target.select()} aria-label="Tanılama raporu" />
          )}
        </>
      )}
    </div>
  )
}
