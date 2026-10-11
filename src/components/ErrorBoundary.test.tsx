import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorBoundary, ErrorFallbackView, type ErrorFallbackViewProps } from './ErrorBoundary.tsx'

const noop = () => {}
const render = (over: Partial<ErrorFallbackViewProps> = {}) =>
  renderToStaticMarkup(
    <ErrorFallbackView
      error={new TypeError("Cannot read properties of undefined (reading 'map')")}
      onRetry={noop}
      onHome={noop}
      onDownloadRaw={noop}
      onRestore={noop}
      onReload={noop}
      {...over}
    />,
  )

describe('ErrorFallbackView', () => {
  it('başlık, veri güvende cümlesi ve kurtarma eylemlerini gösterir', () => {
    const html = render()
    expect(html).toContain('Bir şeyler ters gitti')
    expect(html).toContain('Verilerin hâlâ bu tarayıcıda duruyor')
    for (const label of ['Yeniden dene', 'Ana sayfa', 'Ham veriyi indir']) expect(html).toContain(`>${label}</button>`)
    expect(html).not.toContain('Yenile</button>')
  })

  it('hata mesajını açılır teknik ayrıntıda taşır', () => {
    const html = render()
    expect(html).toContain('<details')
    expect(html).toContain('Teknik ayrıntı')
    expect(html).toContain('TypeError: Cannot read properties of undefined (reading &#x27;map&#x27;)')
  })

  it('Error olmayan değerleri de metne çevirir', () => {
    expect(render({ error: 'düz metin' })).toContain('düz metin')
  })

  it('kopya yoksa geri yükleme düğmesini gizler, varsa tarihiyle gösterir', () => {
    expect(render()).not.toContain('Son otomatik kopyayı geri yükle')
    const at = new Date(2026, 9, 11, 14, 30).getTime()
    const html = render({ snapshotAt: at })
    expect(html).toContain('Son otomatik kopyayı geri yükle')
    expect(html).toContain('Son kopya:')
    expect(html).toContain('2026')
  })

  it('ek mesajı gösterir', () => {
    expect(render({ message: 'Geri yüklenemedi: x' })).toContain('Geri yüklenemedi: x')
  })

  it('parça yükleme hatasında yenile mesajı ve Yenile düğmesi çıkar', () => {
    const html = render({ error: new TypeError('Failed to fetch dynamically imported module: /a.js'), snapshotAt: 1 })
    expect(html).toContain('Sayfa yüklenemedi')
    expect(html).toContain('bağlantını kontrol edip yenile')
    expect(html).toContain('>Yenile</button>')
    expect(html).toContain('>Ana sayfa</button>')
    expect(html).not.toContain('Yeniden dene')
    expect(html).not.toContain('Ham veriyi indir')
  })

  it('standalone modda kendi <main> kabuğunu çizer', () => {
    expect(render({ standalone: true })).toMatch(/^<main class="app">/)
    expect(render()).toMatch(/^<div class="card banner/)
  })
})

describe('ErrorBoundary', () => {
  it('hatayı duruma çevirir; hata yoksa çocukları olduğu gibi çizer', () => {
    const err = new Error('x')
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err, failed: true })
    expect(renderToStaticMarkup(<ErrorBoundary><p>içerik</p></ErrorBoundary>)).toBe('<p>içerik</p>')
  })
})
