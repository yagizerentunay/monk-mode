import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** Alt çekmece. Rota değişince ve Escape ile kapanır (demodaki yığılma sorununu önler). */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (open) onClose()
    // yalnızca rota değişiminde kapat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
