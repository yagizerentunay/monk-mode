/** Monk Mode mührü: dairesel form (odak, süreklilik) + üç keskin çizgi (ilerleme, mücadele). */
export function Seal({ size = 28 }: { size?: number }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M10 22 L15 10 M15.5 23 L20.5 11 M21 22 L24 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
    </svg>
  )
}

/** MONKMODE yazısı; "MODE" bakır renkte. */
export function Wordmark({ seal = false }: { seal?: boolean }) {
  return (
    <span className="brand">
      {seal && <Seal />}
      <span className="wordmark" aria-label="Monk Mode">
        MONK<span>MODE</span>
      </span>
    </span>
  )
}
