import type { KeyboardEvent } from 'react'

export type MapMuscle =
  | 'abdominals' | 'abductors' | 'adductors' | 'biceps' | 'calves' | 'chest' | 'forearms' | 'glutes'
  | 'hamstrings' | 'lats' | 'lower back' | 'middle back' | 'neck' | 'quadriceps' | 'shoulders'
  | 'traps' | 'triceps'

interface Props {
  levels: Record<MapMuscle, number>
  labels: Record<MapMuscle, string>
  selected?: MapMuscle | null
  onSelect?: (m: MapMuscle) => void
}

interface Region {
  id: MapMuscle
  d: string
  /** true: yol zaten tam simetrik, aynalanmaz. Aksi halde sol yarı yazılır, sağ yarı aynalanır. */
  c?: boolean
}

// Her figür 180 genişliğinde yerel koordinatta çizilir (orta eksen x=90); sağ yarı aynalamayla gelir.
const MIRROR = 'translate(180 0) scale(-1 1)'

// Ortak silüet parçaları (sol yarı) ve tam simetrik gövde
const SIL_HALF = [
  // kol (omuzdan el ucuna)
  'M52,60 C42,62 36,74 34,92 L30,124 C27,144 24,164 22,184 L21,198 L35,200 L41,184 C45,164 50,144 54,124 L62,94 L64,66 Z',
  // bacak (kalçadan ayak bileğine)
  'M60,184 C58,210 60,230 65,248 C63,266 63,282 67,296 L65,304 L83,304 L84,296 C86,282 86,266 85,248 C87,232 88,216 88,200 L90,196 L90,184 Z',
]
const TORSO =
  'M62,58 C70,54 80,52 90,52 C100,52 110,54 118,58 L122,90 C121,110 118,128 116,150 C118,164 120,176 120,186 L60,186 C60,176 62,164 64,150 C62,128 59,110 58,90 Z'
const NECK_SHAPE = 'M82,38 L98,38 L100,54 C96,56 84,56 80,54 Z'

// Ön ve arka görünümde ortak şekiller; kolda ve bacakta aynı kas aynı yere oturur
const NECK: Region = { id: 'neck', c: true, d: 'M83,41 L97,41 L99,51 C95,52 85,52 81,51 Z' }
const DELT: Region = { id: 'shoulders', d: 'M53,62 C46,64 41,72 39,84 L60,90 L62,68 C59,64 56,62 53,62 Z' }
const UPPER_ARM = 'M40,84 C37,96 35,110 33,122 L52,124 C55,112 58,100 61,90 L58,76 C52,74 46,76 40,84 Z'
const FOREARM: Region = { id: 'forearms', d: 'M31,128 C29,146 27,164 25,180 L37,182 C41,166 46,148 52,130 Z' }
const CALF: Region = { id: 'calves', d: 'M66,256 C65,268 66,282 69,292 L80,292 C83,282 83,268 83,256 Z' }

const FRONT: Region[] = [
  NECK,
  DELT,
  { id: 'chest', d: 'M65,66 C73,62 82,63 89,67 L89,92 C81,98 72,96 65,90 Z' },
  { id: 'biceps', d: UPPER_ARM },
  FOREARM,
  { id: 'abdominals', c: true, d: 'M78,100 L102,100 L104,148 C100,158 80,158 76,148 Z' },
  { id: 'abductors', d: 'M62,194 C60,210 61,226 65,242 L68,242 C67,226 67,210 67,194 Z' },
  { id: 'quadriceps', d: 'M69,194 C68,210 69,226 70,242 L80,242 C80,226 81,210 81,194 Z' },
  { id: 'adductors', d: 'M83,200 L87,200 C87,216 85,230 83,242 L81,242 C82,226 82,214 83,200 Z' },
  CALF,
]

const BACK: Region[] = [
  NECK,
  { id: 'traps', c: true, d: 'M90,52 C80,53 71,56 64,60 L64,70 C72,74 82,86 90,98 C98,86 108,74 116,70 L116,60 C109,56 100,53 90,52 Z' },
  DELT,
  { id: 'triceps', d: UPPER_ARM },
  FOREARM,
  { id: 'lats', d: 'M62,80 C68,84 74,92 76,100 L76,130 C70,130 66,124 64,116 C61,104 61,92 62,80 Z' },
  { id: 'middle back', d: 'M79,102 L88,102 L88,128 L79,128 Z' },
  { id: 'lower back', c: true, d: 'M80,134 L100,134 L102,158 C96,161 84,161 78,158 Z' },
  { id: 'abductors', d: 'M63,168 C62,176 62,184 63,192 L66,192 C66,184 66,176 67,168 Z' },
  { id: 'glutes', d: 'M68,170 C66,182 67,192 72,198 L88,198 C89,186 89,176 88,168 C82,166 74,167 68,170 Z' },
  { id: 'hamstrings', d: 'M64,204 C62,218 63,232 66,246 L82,246 C84,232 85,218 86,204 Z' },
  CALF,
]

/** Seviye bozuksa (eksik, NaN, aralık dışı) 0 sayılır; çizim asla patlamaz. */
function clamp01(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}

export function MuscleMap({ levels, labels, selected = null, onSelect }: Props) {
  const interactive = typeof onSelect === 'function'

  const renderRegion = (r: Region, side: 'l' | 'r', key: string) => {
    const level = clamp01(levels?.[r.id])
    const label = `${labels?.[r.id] ?? r.id}: ${Math.round(level * 100)}%`
    const isSel = selected === r.id
    const activate = () => onSelect?.(r.id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        activate()
      }
    }
    return (
      <path
        key={key}
        d={r.d}
        data-muscle={r.id}
        transform={side === 'r' ? MIRROR : undefined}
        fill={level > 0 ? 'var(--accent)' : 'var(--card)'}
        fillOpacity={level > 0 ? 0.18 + 0.82 * level : undefined}
        stroke={isSel ? 'var(--text)' : level > 0 ? 'var(--bg)' : 'var(--line)'}
        strokeWidth={isSel ? 2 : 0.8}
        strokeLinejoin="round"
        {...(interactive
          ? {
              role: 'button',
              // Yansıyan kopya klavye durağı olmaz; her kas için tek durak yeter
              tabIndex: side === 'l' ? 0 : -1,
              'aria-label': label,
              'aria-pressed': isSel,
              onClick: activate,
              onKeyDown: onKey,
            }
          : { 'aria-hidden': true })}
      />
    )
  }

  const renderView = (regions: Region[], dx: number, name: string, caption: string) => (
    <g transform={`translate(${dx} 0)`} key={name}>
      <g fill="var(--card-2)" stroke="var(--line)" strokeWidth="1" strokeLinejoin="round">
        <ellipse cx="90" cy="22" rx="14" ry="17" />
        <path d={NECK_SHAPE} />
        {SIL_HALF.map((d, i) => <path key={`sl${i}`} d={d} />)}
        {SIL_HALF.map((d, i) => <path key={`sr${i}`} d={d} transform={MIRROR} />)}
        <path d={TORSO} />
      </g>
      {regions.map((r, i) => renderRegion(r, 'l', `${name}-${i}-l`))}
      {regions.filter((r) => !r.c).map((r, i) => renderRegion(r, 'r', `${name}-${i}-r`))}
      <text x="90" y="322" fontSize="11" fill="var(--muted)" textAnchor="middle">{caption}</text>
    </g>
  )

  return (
    <svg className="musclemap" viewBox="0 0 360 330" role="group" aria-label="Kas haritası">
      {renderView(FRONT, 0, 'front', 'Ön')}
      {renderView(BACK, 180, 'back', 'Arka')}
    </svg>
  )
}
