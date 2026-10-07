import { useEffect, useRef, useState } from 'react'
import { formatClock, restDoneAlert } from '../lib/alert.ts'

interface Props {
  /** Bitiş zamanı (epoch ms). */
  endsAt: number
  onChange: (endsAt: number | null) => void
}

/** Set tamamlanınca beliren yüzen geri sayım çubuğu. */
export function RestTimer({ endsAt, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const alerted = useRef(false)

  useEffect(() => {
    alerted.current = false
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endsAt])

  const left = Math.ceil((endsAt - now) / 1000)

  useEffect(() => {
    if (left <= 0 && !alerted.current) {
      alerted.current = true
      restDoneAlert()
    }
  }, [left])

  const done = left <= 0
  return (
    <div className={`rest${done ? ' done' : ''}`} role="timer">
      <button className="btn small" onClick={() => onChange(endsAt - 15000)} aria-label="15 saniye azalt">−15</button>
      <div className="grow rest-time">{done ? 'Hazır!' : formatClock(left)}</div>
      <button className="btn small" onClick={() => onChange(endsAt + 15000)} aria-label="15 saniye ekle">+15</button>
      <button className="btn small" onClick={() => onChange(null)}>{done ? 'Kapat' : 'Geç'}</button>
    </div>
  )
}
