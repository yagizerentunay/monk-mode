/** Sessiz bölge (modül): standart en az 4 ister. */
const QUIET = 4

interface Props {
  /** `encodeQr` çıktısı (true koyu). */
  matrix: boolean[][]
  label: string
}

/**
 * QR matrisini tek bir SVG yoluyla çizer. Renkler temadan bağımsız sabit siyah/beyazdır (okuyucular açık
 * zeminde koyu modül bekler); stil özniteliği kullanılmaz, CSP'ye takılmaz.
 */
export function QrCode({ matrix, label }: Props) {
  const n = matrix.length + QUIET * 2
  let d = ''
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`
    }),
  )
  return (
    <svg className="qr" viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}
