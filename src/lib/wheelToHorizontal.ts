export interface ScrollMetrics {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}

/** `WheelEvent.deltaMode` değerleri: piksel, satır, sayfa. */
const LINE_PX = 16

/**
 * Dikey fare tekerleği hareketini yatay kaydırmaya çevirir: kaydırılacak piksel miktarını döndürür.
 * Şu durumlarda `null` döner (sayfa kendi kaydırmasını yapsın): satır taşmıyorsa, olayda zaten anlamlı yatay
 * bileşen varsa (dokunmatik yüzey, Shift+tekerlek), dikey hareket yoksa ya da satır o yönde sonuna geldiyse.
 */
export function wheelToHorizontal(m: ScrollMetrics, deltaX: number, deltaY: number, deltaMode = 0): number | null {
  const max = m.scrollWidth - m.clientWidth
  if (max <= 1) return null
  if (Math.abs(deltaX) > 1 || deltaY === 0) return null
  if (deltaY > 0 && m.scrollLeft >= max - 1) return null
  if (deltaY < 0 && m.scrollLeft <= 0) return null
  if (deltaMode === 1) return deltaY * LINE_PX
  if (deltaMode === 2) return deltaY * m.clientWidth
  return deltaY
}
