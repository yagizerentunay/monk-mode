import { useState } from 'react'
import { formatClockField, parseDuration } from '../lib/timed.ts'

interface Props {
  /** Saniye. */
  value: number
  onChange: (sec: number) => void
  label?: string
  className?: string
}

/**
 * Süre girişi: değilken "d:ss" (0:45, 1:30) gösterir; yazarken "90" ya da "1:30" kabul eder. Geçersiz ya da
 * yarım girdi ("1:") kaydedilen değeri değiştirmez, alan odaktan çıkınca kayıtlı değere döner.
 */
export function DurationField({ value, onChange, label, className = '' }: Props) {
  // Odaktayken kullanıcının yazdığı ham metin, değilken kayıtlı değer gösterilir (bkz. NumberField).
  const [text, setText] = useState<string | null>(null)

  return (
    <input
      className={`input num numfield ${className}`}
      inputMode="numeric"
      aria-label={label}
      value={text ?? formatClockField(value)}
      onFocus={(e) => {
        setText(formatClockField(value))
        e.target.select()
      }}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value)
        const sec = parseDuration(e.target.value)
        if (sec !== null) onChange(sec)
      }}
    />
  )
}
