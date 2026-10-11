import { useEffect, useState } from 'react'
import { formatClock } from '../lib/alert.ts'

/** Geçen süre sayacı. Saniye tiki yalnız bu bileşeni yeniden çizer; Workout ekranının geri kalanı etkilenmez. */
export function WorkoutClock({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  return <span className="wk-clock bignum">{formatClock((now - start) / 1000)}</span>
}
