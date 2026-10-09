import { useState } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  /** Gösterilen değer ile kaydedilen değer arasındaki dönüşüm (örn. kg ↔ lb). */
  toDisplay?: (v: number) => number
  fromDisplay?: (v: number) => number
  step?: number
  min?: number
  label?: string
  className?: string
}

const round = (v: number) => Math.round(v * 100) / 100

/** Yazarken "62." gibi ara değerlere izin veren sayı girişi. */
export function NumberField({
  value,
  onChange,
  toDisplay = (v) => v,
  fromDisplay = (v) => v,
  step = 1,
  min = 0,
  label,
  className = '',
}: Props) {
  const shown = round(toDisplay(value))
  // Odaktayken kullanıcının yazdığı ham metin, değilken kayıtlı değer gösterilir.
  const [text, setText] = useState<string | null>(null)

  return (
    <input
      className={`input num numfield ${className}`}
      // Eksi işareti için tuş takımı: ondalık sayı tuş takımında (özellikle iOS'ta) eksi yoktur.
      inputMode={min < 0 ? 'text' : 'decimal'}
      aria-label={label}
      value={text ?? String(shown)}
      step={step}
      onFocus={(e) => {
        setText(String(shown))
        e.target.select()
      }}
      onBlur={() => setText(null)}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min) onChange(round(fromDisplay(n)))
      }}
    />
  )
}
