import { t } from '../i18n/index.ts'
import { useEffect, useState } from 'react'
import { elapsedSec, formatClockField } from '../lib/timed.ts'

interface Props {
  /** Erişilebilir ad (başlatma halinde); durdurma düğmesi "durdur" ekler. */
  label: string
  /** Tek taraflı sette düğmedeki taraf adı ("Sol", "Sağ"); yoksa "Süre ölç". */
  caption?: string
  /** Durdurulunca geçen saniye (0-3600) verilir; kaydetmek ve seti tamamlamak çağıranın işidir. */
  onStop: (sec: number) => void
}

/**
 * Tutuş kronometresi: başlat / durdur. Süre başlangıç damgasından hesaplanır (bkz. elapsedSec); aralık
 * yalnız ekranı tazeler, bu yüzden arka plana geçmek ya da yeniden çizim saniyeyi kaydırmaz.
 */
export function HoldTimer({ label, caption, onStop }: Props) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === null) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [startedAt])

  if (startedAt === null) {
    return (
      <button
        className="chip hold"
        aria-label={t('hold.startAria', { label })}
        onClick={() => {
          setNow(Date.now())
          setStartedAt(Date.now())
        }}
      >
        ▶ {caption ?? t('hold.measure')}
      </button>
    )
  }
  return (
    <button
      className="chip hold on"
      aria-label={t('hold.stopAria', { label })}
      onClick={() => {
        onStop(elapsedSec(startedAt, Date.now()))
        setStartedAt(null)
      }}
    >
      ■ {caption ? `${caption} ` : ''}{formatClockField(elapsedSec(startedAt, now))}
    </button>
  )
}
