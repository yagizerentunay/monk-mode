import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Alt çekmece (modal). Rota değişince ve Escape ile kapanır (demodaki yığılma sorununu önler).
 * Erişilebilirlik: açılınca odak çekmeceye taşınır (içeride autoFocus'lu alan varsa ona dokunulmaz),
 * Tab/Shift+Tab çekmece içinde döner, kapanınca odak açan öğeye geri döner; açıkken arka plan kaymaz.
 */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const { pathname } = useLocation()
  const lastPath = useRef(pathname)
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    // Yalnız rota GERÇEKTEN değişince kapat. İlk mount'ta (open=true ile doğan sheet) kapatmak,
    // takvim gibi açılırken mount olan sheet'leri anında kapatırdı.
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      const sheet = sheetRef.current
      if (e.key !== 'Tab' || !sheet) return
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) {
        e.preventDefault()
        sheet.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = sheet.contains(active) && active !== sheet
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Açılışta odağı al ve arka planı kilitle; kapanınca ikisini de geri ver.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const sheet = sheetRef.current
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="sheet-back" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grab" />
        {title && <h2 id={titleId}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
