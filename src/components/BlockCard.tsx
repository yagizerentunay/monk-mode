import { locale, t } from '../i18n/index.ts'
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

const short = (d: string) => parseDay(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })

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
    <section className="card stack blockcard" aria-label={t('block.title')}>
      <div className="row between">
        <div className="eyebrow">{t('block.title')}</div>
        {st && (
          <span className={`sub${st.deload ? ' warntext' : ''}`}>
            {st.phase === 'upcoming' ? t('block.notStarted') : st.phase === 'over' ? t('block.expired') : t('block.weekOf', { week: st.week, weeks: st.weeks })}
          </span>
        )}
      </div>

      {block && st ? (
        <>
          <div className="sub">
            {t('count.weeks', { n: block.weeks })} · {span(block)}
            <br />
            {t('block.deloadLine', { week: t('block.weekN', { n: block.deload }), range: range(block, block.deload) })}
            {st.deload ? ` · ${t('block.thisWeek')}` : ''}
          </div>
          <div className="row">
            <button className="btn small grow" onClick={() => setEditing(true)}>{t('common.edit')}</button>
            <button className={`btn small grow${st.phase === 'over' ? ' primary' : ''}`} onClick={() => endBlock('done', dayString(today))}>
              {t('block.finish')}
            </button>
            <button
              className="btn small grow"
              onClick={() => {
                if (confirm(t('block.cancelConfirm'))) endBlock('cancelled', dayString(today))
              }}
            >
              {t('block.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sub">
            {t('block.intro')}
          </div>
          <button className="btn block" onClick={() => setEditing(true)}>{t('block.start')}</button>
        </>
      )}

      {history.length > 0 && (
        <div className="stack blockhistory">
          <div className="eyebrow muted">{t('block.history')}</div>
          <ul>
            {history.map((b) => (
              <PastRow key={b.id} block={b} />
            ))}
          </ul>
        </div>
      )}

      <BottomSheet open={editing} onClose={() => setEditing(false)} title={block ? t('block.edit') : t('block.start')}>
        {editing && <BlockForm block={block} today={today} weekStart={weekStart} onDone={() => setEditing(false)} />}
      </BottomSheet>
    </section>
  )
}

function PastRow({ block }: { block: PastBlock }) {
  return (
    <li className="row between">
      <span>
        {t('count.weeks', { n: block.weeks })} · {short(block.start)} – {short(block.end)}
      </span>
      <span className={block.outcome === 'done' ? 'sub ok' : 'sub'}>{block.outcome === 'done' ? t('block.done') : t('block.cancelled')}</span>
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
        <span className="sub">{t('block.startDay')}</span>
        <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <span className="sub">{t('block.firstWeek', { range: range(1) })}</span>
      <div className="field">
        <span className="sub" id="block-weeks">{t('block.weekCount')}</span>
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
              {t('count.weeks', { n })}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="sub">{t('blockStrip.deloadWeek')}</span>
        <select className="input" value={deload} onChange={(e) => setDeload(Number(e.target.value))}>
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              {t('block.weekN', { n: w })} ({range(w)}){w === weeks ? ` · ${t('block.lastWeek')}` : ''}
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
        {block ? t('common.save') : t('block.startCta')}
      </button>
    </div>
  )
}
