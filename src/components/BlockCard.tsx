import { useState } from 'react'
import {
  blockStatus,
  blockWeekRange,
  DEFAULT_BLOCK_WEEKS,
  MAX_BLOCK_WEEKS,
  MIN_BLOCK_WEEKS,
  parseDay,
} from '../lib/block.ts'
import { isDay } from '../store/sanitize.ts'
import { dayString } from '../lib/workout.ts'
import type { PastBlock, TrainingBlock } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'
import { BottomSheet } from './BottomSheet.tsx'

const WEEK_CHOICES = Array.from({ length: MAX_BLOCK_WEEKS - MIN_BLOCK_WEEKS + 1 }, (_, i) => MIN_BLOCK_WEEKS + i)

/** Plan'da kaç geçmiş blok listelenir. */
const HISTORY_SHOWN = 5

const short = (d: string) => parseDay(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

/**
 * Plan sekmesinde antrenman bloğu (mezosiklus) yönetimi: başlat, düzenle, bitir, iptal et ve biten
 * blokların kısa geçmişi. Haftalar takvim haftasıdır (Ayarlar'daki hafta başlangıcı, bkz. lib/block.ts).
 */
export function BlockCard() {
  const block = useStore((s) => s.block)
  const pastBlocks = useStore((s) => s.pastBlocks)
  const weekStart = useStore((s) => s.settings.weekStart)
  const endBlock = useStore((s) => s.endBlock)
  const [today] = useState(() => new Date())
  const [editing, setEditing] = useState(false)

  const history = pastBlocks.slice(-HISTORY_SHOWN).reverse()
  const st = block ? blockStatus(block, today, weekStart) : undefined
  const range = (b: TrainingBlock, week: number) => {
    const r = blockWeekRange(b, week, weekStart)
    return `${short(r.first)} – ${short(r.last)}`
  }
  const span = (b: TrainingBlock) =>
    `${short(blockWeekRange(b, 1, weekStart).first)} – ${short(blockWeekRange(b, b.weeks, weekStart).last)}`

  return (
    <div className="card stack blockcard" aria-label="Antrenman bloğu">
      <div className="row between">
        <div className="eyebrow">Antrenman bloğu</div>
        {st && (
          <span className={`sub${st.deload ? ' warntext' : ''}`}>
            {st.phase === 'upcoming' ? 'Başlamadı' : st.phase === 'over' ? 'Süresi doldu' : `${st.week}/${st.weeks}. hafta`}
          </span>
        )}
      </div>

      {block && st ? (
        <>
          <div className="sub">
            {block.weeks} hafta · {span(block)}
            <br />
            Deload: {block.deload}. hafta ({range(block, block.deload)}){st.deload ? ' · bu hafta' : ''}
          </div>
          <div className="row">
            <button className="btn small grow" onClick={() => setEditing(true)}>Düzenle</button>
            <button className={`btn small grow${st.phase === 'over' ? ' primary' : ''}`} onClick={() => endBlock('done', dayString(today))}>
              Bitir
            </button>
            <button
              className="btn small grow"
              onClick={() => {
                if (confirm('Blok iptal edilsin mi? Geçmişte "iptal" olarak kalır.')) endBlock('cancelled', dayString(today))
              }}
            >
              İptal et
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sub">
            4–6 haftalık bir blok kur; son hafta (ya da seçtiğin hafta) planlı deload olsun. Ana Sayfa hangi haftada olduğunu gösterir.
          </div>
          <button className="btn block" onClick={() => setEditing(true)}>Blok başlat</button>
        </>
      )}

      {history.length > 0 && (
        <div className="stack blockhistory">
          <div className="eyebrow muted">Geçmiş bloklar</div>
          <ul>
            {history.map((b) => (
              <PastRow key={b.id} block={b} />
            ))}
          </ul>
        </div>
      )}

      <BottomSheet open={editing} onClose={() => setEditing(false)} title={block ? 'Bloğu düzenle' : 'Blok başlat'}>
        {editing && <BlockForm block={block} today={today} weekStart={weekStart} onDone={() => setEditing(false)} />}
      </BottomSheet>
    </div>
  )
}

function PastRow({ block }: { block: PastBlock }) {
  return (
    <li className="row between">
      <span>
        {block.weeks} hafta · {short(block.start)} – {short(block.end)}
      </span>
      <span className={block.outcome === 'done' ? 'sub ok' : 'sub'}>{block.outcome === 'done' ? 'Bitti' : 'İptal'}</span>
    </li>
  )
}

function BlockForm({
  block,
  today,
  weekStart,
  onDone,
}: {
  block: TrainingBlock | null
  today: Date
  weekStart: number
  onDone: () => void
}) {
  const startBlock = useStore((s) => s.startBlock)
  const editBlock = useStore((s) => s.editBlock)
  const [start, setStart] = useState(block?.start ?? dayString(today))
  const [weeks, setWeeks] = useState(block?.weeks ?? DEFAULT_BLOCK_WEEKS)
  const [deload, setDeload] = useState(block?.deload ?? DEFAULT_BLOCK_WEEKS)
  const valid = isDay(start)
  const preview: TrainingBlock = { id: '', start: valid ? start : dayString(today), weeks, deload }
  const range = (week: number) => {
    const r = blockWeekRange(preview, week, weekStart)
    return `${short(r.first)} – ${short(r.last)}`
  }

  return (
    <div className="stack">
      <label className="field">
        <span className="sub">Başlangıç günü</span>
        <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <span className="sub">1. hafta bu günün haftasıdır: {range(1)}</span>
      <div className="field">
        <span className="sub" id="block-weeks">Hafta sayısı</span>
        <div className="seg" role="radiogroup" aria-labelledby="block-weeks">
          {WEEK_CHOICES.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={weeks === n}
              className={weeks === n ? 'on' : ''}
              onClick={() => {
                // Deload son haftadaysa (varsayılan) yeni son haftaya kayar.
                if (deload === weeks || deload > n) setDeload(n)
                setWeeks(n)
              }}
            >
              {n} hafta
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="sub">Deload haftası</span>
        <select className="input" value={deload} onChange={(e) => setDeload(Number(e.target.value))}>
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              {w}. hafta ({range(w)}){w === weeks ? ' · son hafta' : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn primary block"
        disabled={!valid}
        onClick={() => {
          if (block) editBlock({ start, weeks, deload })
          else startBlock(start, weeks, deload)
          onDone()
        }}
      >
        {block ? 'Kaydet' : 'Bloğu başlat'}
      </button>
    </div>
  )
}
