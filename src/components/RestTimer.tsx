import { t } from '../i18n/index.ts'
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
      <div className="rest-label">
        <span className="eyebrow">{t('rest.title')}</span>
        <div className="rest-time bignum">{done ? t('rest.ready') : formatClock(left)}</div>
      </div>
      <div className="rest-actions">
        <button className="btn small" onClick={() => onChange(endsAt - 15000)} aria-label={t('rest.minusAria')}>−{t('unit.secValue', { n: 15 })}</button>
        <button className="btn small" onClick={() => onChange(endsAt + 15000)} aria-label={t('rest.plusAria')}>+{t('unit.secValue', { n: 15 })}</button>
        <button className="btn small rest-skip" onClick={() => onChange(null)}>{done ? t('common.close') : t('rest.skip')}</button>
      </div>
    </div>
  )
}
