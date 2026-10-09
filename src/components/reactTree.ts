import { isValidElement, type ReactElement, type ReactNode } from 'react'

type Clickable = ReactElement<{ 'aria-label'?: string; children?: ReactNode; onClick?: () => void }>

/**
 * Bileşen testleri için (DOM/jsdom yok): kancasız bir bileşeni doğrudan çağırıp dönen React ağacında
 * `aria-label`'ı eşleşen ilk öğeyi bulur; dokunuşu `el.props.onClick()` ile taklit eder.
 */
export function findByLabel(node: ReactNode, label: string): Clickable | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findByLabel(n, label)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<Clickable['props']>(node)) return undefined
  if (node.props['aria-label'] === label) return node as Clickable
  return findByLabel(node.props.children, label)
}

/** Etiketle bulunan düğmeye "dokunur". Bulunamazsa hata fırlatır (test net başarısız olur). */
export function tapByLabel(tree: ReactNode, label: string): void {
  const el = findByLabel(tree, label)
  if (!el?.props.onClick) throw new Error(`Dokunulacak öğe bulunamadı: ${label}`)
  el.props.onClick()
}
