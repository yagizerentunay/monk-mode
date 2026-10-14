import { useEffect, type RefObject } from 'react'
import { wheelToHorizontal } from './wheelToHorizontal.ts'

/**
 * Yatay taşan satırın üzerinde dikey fare tekerleğini yatay kaydırmaya çevirir. React'in `onWheel`'i pasif
 * dinleyici olduğundan `preventDefault` çalışmaz; bu yüzden yerel, pasif olmayan bir dinleyici eklenir.
 */
export function useWheelToHorizontal(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return
      const dx = wheelToHorizontal(el, e.deltaX, e.deltaY, e.deltaMode)
      if (dx === null) return
      e.preventDefault()
      el.scrollLeft += dx
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])
}
