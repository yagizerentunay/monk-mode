export interface ChartPoint {
  label: string
  value: number
}

interface Props {
  points: ChartPoint[]
  unit?: string
  height?: number
}

const W = 320
const PAD = { l: 8, r: 8, t: 14, b: 22 }

/** Bağımlılıksız küçük çizgi grafiği. Tek nokta varsa yalnız nokta çizilir. */
export function LineChart({ points, unit = '', height = 140 }: Props) {
  if (points.length === 0) return <p className="sub">Henüz veri yok.</p>

  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const span = max - min
  const x = (i: number) =>
    points.length === 1 ? W / 2 : PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (height - PAD.t - PAD.b)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Grafik" style={{ display: 'block' }}>
      <line x1={PAD.l} x2={W - PAD.r} y1={height - PAD.b} y2={height - PAD.b} stroke="var(--line)" strokeWidth="1" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.slice(0, -1).map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="2.5" fill="var(--accent)" />
      ))}
      {/* son nokta: halka + bakır dolgu */}
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="8" fill="var(--accent)" fillOpacity="0.22" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill="var(--accent)" stroke="var(--card)" strokeWidth="1.5" />
      <text x={PAD.l} y={height - 6} fontSize="10" fill="var(--muted)">{points[0].label}</text>
      <text x={W - PAD.r} y={height - 6} fontSize="10" fill="var(--muted)" textAnchor="end">{last.label}</text>
      <text x={W - PAD.r} y={10} fontSize="12" fontWeight="700" fill="var(--text)" textAnchor="end">
        {last.value}{unit && ` ${unit}`}
      </text>
    </svg>
  )
}
