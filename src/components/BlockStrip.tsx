import { locale, t } from '../i18n/index.ts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { blockStatus, parseDay } from '../lib/block.ts'
import { deloadCutText, deloadRirText } from '../lib/deload.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Ana sayfadaki blok şeridi: "Blok: 3/5. hafta". Deload haftasında açık bir uyarı ve azaltma önerisi
 * (otomatik deload önerisiyle aynı sabitler: lib/deload.ts). Süren blok yoksa görünmez.
 */
export function BlockStrip() {
  const block = useStore((s) => s.block)
  const weekStart = useStore((s) => s.settings.weekStart)
  const [today] = useState(() => new Date())
  if (!block) return null

  const st = blockStatus(block, today, weekStart)
  if (st.phase === 'upcoming') {
    const start = parseDay(block.start).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
    return (
      <Link to="/plan" className="card tap blockstrip" aria-label={t('blockStrip.upcomingAria', { start })}>
        <span className="eyebrow muted">{t('blockStrip.block')}</span>
        <span className="sub">{t('blockStrip.starts', { start })} · {t('count.weeks', { n: block.weeks })}</span>
      </Link>
    )
  }
  if (st.phase === 'over') {
    return (
      <Link to="/plan" className="card tap blockstrip" aria-label={t('blockStrip.overAria')}>
        <span className="eyebrow ok">✓ {t('blockStrip.over')}</span>
        <span className="sub">{t('blockStrip.overHint', { weeks: t('count.weeks', { n: block.weeks }) })}</span>
      </Link>
    )
  }

  const left = block.deload - st.week
  return (
    <div className="stack">
      <Link
        to="/plan"
        className={`card tap blockstrip${st.deload ? ' deload' : ''}`}
        aria-label={t('blockStrip.weekAria', {
          week: t('blockStrip.week', { week: st.week, weeks: st.weeks }),
          deload: st.deload ? t('blockStrip.deloadAria') : '',
        })}
      >
        <span className="eyebrow">{t('blockStrip.week', { week: st.week, weeks: st.weeks })}</span>
        <span className="blockbar" aria-hidden="true">
          {Array.from({ length: st.weeks }, (_, i) => (
            <span key={i} className={`${i + 1 < st.week ? 'on' : ''}${i + 1 === st.week ? ' now' : ''}${i + 1 === block.deload ? ' dl' : ''}`} />
          ))}
        </span>
        <span className="sub">
          {st.deload ? t('blockStrip.deloadWeek') : left > 0 ? t('blockStrip.deloadIn', { weeks: t('count.weeks', { n: left }) }) : t('blockStrip.deloadPassed')}
        </span>
      </Link>
      {st.deload && (
        <div className="card banner stack" role="status">
          <b className="banner-title">{t('blockStrip.plannedDeload')}</b>
          <div className="sub">{t('blockStrip.plannedDeloadHint', { cut: deloadCutText(), rir: deloadRirText() })}</div>
        </div>
      )}
    </div>
  )
}
