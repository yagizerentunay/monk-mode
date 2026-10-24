import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../i18n/index.ts'
import { formatDateTime } from '../lib/calendar.ts'
import { isChunkLoadError } from '../lib/chunkError.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { downloadRaw } from '../store/downloadBackup.ts'
import { STORAGE_KEY } from '../store/persist.ts'
import { listSnapshots, loadSnapshot } from '../store/snapshots.ts'
import { useStore } from '../store/useStore.ts'


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
        <b className="banner-title">{chunk ? t('error.chunkTitle') : t('error.title')}</b>
        <div className="sub">
          {chunk ? t('error.chunkBody') : t('error.body')}
        </div>
      </div>
      <div className="stack">
        {chunk ? (
          <button className="btn primary block" onClick={p.onReload}>{t('diag.refresh')}</button>
        ) : (
          <button className="btn primary block" onClick={p.onRetry}>{t('error.retry')}</button>
        )}
        <button className="btn block" onClick={p.onHome}>{t('error.home')}</button>
        {!chunk && (
          <>
            <button className="btn block" onClick={p.onDownloadRaw}>{t('storage.downloadRaw')}</button>
            {p.snapshotAt !== undefined && (
              <div>
                <button className="btn block" onClick={p.onRestore}>{t('error.restoreLast')}</button>
                <div className="sub">{t('error.lastCopy', { when: formatDateTime(p.snapshotAt) })}</div>
              </div>
            )}
          </>
        )}
      </div>
      {p.message && <div className="sub" role="status">{p.message}</div>}
      <details className="error-detail">
        <summary className="sub">{t('error.details')}</summary>
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
    if (!confirm(t('snapshots.confirm', { when: formatDateTime(snapshotAt) }))) return
    try {
      const state = await loadSnapshot(snapshotAt)
      try {
        await snapshotNow(t('snapshot.beforeSnapshotRestore'))
      } catch {
        // Bozuk mevcut veri kopyalanamayabilir; geri yükleme yine de sürer.
      }
      useStore.getState().replaceAll(state)
      onReset()
    } catch (e) {
      setMessage(t('error.restoreFailed', { error: e instanceof Error ? e.message : t('error.unknown') }))
    }
  }

  const downloadRawData = () => {
    try {
      downloadRaw(localStorage.getItem(STORAGE_KEY) ?? '')
    } catch (e) {
      setMessage(t('error.rawFailed', { error: e instanceof Error ? e.message : t('error.unknown') }))
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
