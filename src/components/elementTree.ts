import { isValidElement, type ReactElement, type ReactNode } from 'react'

type Props = Record<string, unknown> & { children?: ReactNode }

/**
 * Yalnız testler için: DOM (jsdom) olmadan, saf bir bileşenin döndürdüğü React ağacında gezinir ve
 * `onClick` gibi işleyicileri doğrudan çağırmayı sağlar. İşlev bileşenleri açılmaz; gezilecek ağaç yalnız
 * düz öğelerden (div, button…) oluşmalıdır.
 */
export function findAll(node: ReactNode, pred: (el: ReactElement<Props>) => boolean): ReactElement<Props>[] {
  const out: ReactElement<Props>[] = []
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!isValidElement<Props>(n)) return
    if (pred(n)) out.push(n)
    walk(n.props.children)
  }
  walk(node)
  return out
}

/** `aria-label`'i verilen ilk öğe (yoksa hata: testte yanlış etiket sessizce geçmesin). */
export function byLabel(node: ReactNode, label: string): ReactElement<Props> {
  const [el] = findAll(node, (e) => e.props['aria-label'] === label)
  if (!el) throw new Error(`aria-label="${label}" bulunamadı`)
  return el
}

/** Öğenin tıklama işleyicisini çağırır; `disabled` ise tarayıcı gibi hiçbir şey yapmaz. */
export function click(el: ReactElement<Props>): void {
  if (el.props.disabled) return
  const fn = el.props.onClick
  if (typeof fn === 'function') (fn as () => void)()
}

/** Ağaçtaki düz metin (bitişik). */
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return isValidElement<Props>(node) ? textOf(node.props.children) : ''
}

/** Görünen metni verilen en içteki öğe (etiketi olmayan düğmeler için). */
export function byText(node: ReactNode, text: string): ReactElement<Props> {
  const found = findAll(node, (e) => typeof e.type === 'string' && textOf(e.props.children) === text)
  if (found.length === 0) throw new Error(`"${text}" metni bulunamadı`)
  return found[found.length - 1]
}
