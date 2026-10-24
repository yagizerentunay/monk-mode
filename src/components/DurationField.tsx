import { useState } from 'react'
import { formatLongClock, parseLongDuration } from '../lib/distance.ts'
import { formatClockField, parseDuration } from '../lib/timed.ts'

interface Props {
  /** Saniye. */
  value: number
  onChange: (sec: number) => void
  label?: string
  className?: string
  /**
   * Kardiyo süresi (mesafe setleri, bkz. lib/distance.ts): "45:00" / "1:05:30" gösterir, düz sayı dakikadır
   * ("30" = 30:00) ve sınır 24 saattir. Yoksa süreli tutuş: düz sayı saniye, sınır 3600.
   */
  long?: boolean
}

/**
 * Süre girişi: değilken "d:ss" (0:45, 1:30) gösterir; yazarken "90" ya da "1:30" kabul eder. Geçersiz ya da
 * yarım girdi ("1:") kaydedilen değeri değiştirmez, alan odaktan çıkınca kayıtlı değere döner.
 */
export function DurationField({ value, onChange, label, className = '', long = false }: Props) {
  // Odaktayken kullanıcının yazdığı ham metin, değilken kayıtlı değer gösterilir (bkz. NumberField).
  const [text, setText] = useState<string | null>(null)
  const format = long ? formatLongClock : formatClockField
  const parse = long ? parseLongDuration : parseDuration

  return (
    <input
      className={`input num numfield ${className}`}
      inputMode={long ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text ?? format(value)}
      onFocus={(e) => {
        setText(format(value))
        e.target.select()
      }}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value)
        const sec = parse(e.target.value)
        if (sec !== null) onChange(sec)
      }}
    />
  )
}
