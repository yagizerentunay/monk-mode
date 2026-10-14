import { useRef, type HTMLAttributes } from 'react'
import { useWheelToHorizontal } from '../lib/useWheelToHorizontal.ts'

/** Yatay kaydırılan çip satırı: telefonda dokunarak, masaüstünde tekerlek ve ince kaydırma çubuğuyla. */
export function ChipRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useWheelToHorizontal(ref)
  return <div ref={ref} className={className ? `chips ${className}` : 'chips'} {...rest} />
}
