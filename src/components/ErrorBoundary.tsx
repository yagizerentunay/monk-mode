import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isChunkLoadError } from '../lib/chunkError.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { downloadRaw } from '../store/downloadBackup.ts'
import { STORAGE_KEY } from '../store/persist.ts'
import { listSnapshots, loadSnapshot } from '../store/snapshots.ts'
import { useStore } from '../store/useStore.ts'

const formatWhen = (at: number) => new Date(at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

export interface ErrorFallbackViewProps {
  error: unknown
  /** Sarmalayıcı kendi ana öğesini çizsin (router ve uygulama kabuğu dışındaki en üst sınır için). */
  standalone?: boolean
  /** En son otomatik kopyanın zamanı (ms); kopya yoksa ya da IndexedDB kullanılamıyorsa undefined. */
  snapshotAt?: number
  message?: string | null
  onRetry: () => void
  onHome: () => void
  onDownloadRaw: () => void
  onRestore: () => void
  onReload: () => void
}

/** Sınırın görünümü: yalnızca prop'larla çizilir, store'a ya da router'a dokunmaz (kolay test edilir). */
export function ErrorFallbackView(p: ErrorFallbackViewProps) {
  const chunk = isChunkLoadError(p.error)
  const detail = p.error instanceof Error ? `${p.error.name}: ${p.error.message}` : String(p.error)
  const body = (
    <div className="card banner stack error-fallback" role="alert">
      <div>
        <b className="banner-title">{chunk ? 'Sayfa yüklenemedi' : 'Bir şeyler ters gitti'}</b>
        <div className="sub">
          {chunk
            ? 'Sayfa yüklenemedi; bağlantını kontrol edip yenile. Verilerin cihazında duruyor.'
            : 'Verilerin hâlâ bu tarayıcıda duruyor. Yeniden deneyebilir ya da aşağıdan veriyi kurtarabilirsin.'}
        </div>
      </div>
      <div className="stack">
        {chunk ? (
          <button className="btn primary block" onClick={p.onReload}>Yenile</button>
        ) : (
          <button className="btn primary block" onClick={p.onRetry}>Yeniden dene</button>
        )}
        <button className="btn block" onClick={p.onHome}>Ana sayfa</button>
        {!chunk && (
          <>
            <button className="btn block" onClick={p.onDownloadRaw}>Ham veriyi indir</button>
            {p.snapshotAt !== undefined && (
              <div>
                <button className="btn block" onClick={p.onRestore}>Son otomatik kopyayı geri yükle</button>
                <div className="sub">Son kopya: {formatWhen(p.snapshotAt)}</div>
              </div>
            )}
          </>
        )}
      </div>
      {p.message && <div className="sub" role="status">{p.message}</div>}
      <details className="error-detail">
        <summary className="sub">Teknik ayrıntı</summary>
        <pre>{detail}</pre>
      </details>
    </div>
  )
  return p.standalone ? <main className="app">{body}</main> : body
}

function ErrorFallback({ error, standalone, onReset }: { error: unknown; standalone?: boolean; onReset: () => void }) {
  const [snapshotAt, setSnapshotAt] = useState<number | undefined>()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listSnapshots()
      .then((l) => alive && setSnapshotAt(l[0]?.at))
      .catch(() => {}) // IndexedDB yok ya da açılamadı: seçenek gizli kalır.
    return () => {
      alive = false
    }
  }, [])

  const restore = async () => {
    if (snapshotAt === undefined) return
    if (!confirm(`Tüm veriler ${formatWhen(snapshotAt)} kopyasıyla değiştirilsin mi? Şu anki hâlin de önce kopyalanır.`)) return
    try {
      const state = await loadSnapshot(snapshotAt)
      try {
        await snapshotNow('Geri yüklemeden önce')
      } catch {
        // Bozuk mevcut veri kopyalanamayabilir; geri yükleme yine de sürer.
      }
      useStore.getState().replaceAll(state)
      onReset()
    } catch (e) {
      setMessage(`Geri yüklenemedi: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`)
    }
  }

  const downloadRawData = () => {
    try {
      downloadRaw(localStorage.getItem(STORAGE_KEY) ?? '')
    } catch (e) {
      setMessage(`Ham veri indirilemedi: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`)
    }
  }

  return (
    <ErrorFallbackView
      error={error}
      standalone={standalone}
      snapshotAt={snapshotAt}
      message={message}
      onRetry={onReset}
      onHome={() => {
        location.hash = '#/'
        onReset()
      }}
      onDownloadRaw={downloadRawData}
      onRestore={() => void restore()}
      onReload={() => location.reload()}
    />
  )
}

interface Props {
  children: ReactNode
  /** Router dışındaki en üst sınır: fallback kendi `<main>` kabuğunu çizer. */
  standalone?: boolean
}

interface BoundaryState {
  error: unknown
  failed: boolean
}

/** Render sırasında fırlayan hatayı yakalar; beyaz ekran yerine kurtarma seçenekleri gösterir. */
export class ErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = { error: null, failed: false }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error, failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Render hatası:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null, failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorFallback error={this.state.error} standalone={this.props.standalone} onReset={this.reset} />
  }
}

/** Rota değişince sınırı sıfırlar: bir ekran çökünce sekme çubuğundan başka ekrana geçmek yeter. HashRouter içinde olmalı. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
}
