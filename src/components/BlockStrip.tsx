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
    const start = parseDay(block.start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    return (
      <Link to="/plan" className="card tap blockstrip" aria-label={`Blok ${start} tarihinde başlıyor, Plan'da aç`}>
        <span className="eyebrow muted">Blok</span>
        <span className="sub">{start} tarihinde başlıyor · {block.weeks} hafta</span>
      </Link>
    )
  }
  if (st.phase === 'over') {
    return (
      <Link to="/plan" className="card tap blockstrip" aria-label="Blok tamamlandı, Plan'da bitir">
        <span className="eyebrow ok">✓ Blok tamamlandı</span>
        <span className="sub">{block.weeks} hafta bitti · Plan'da kapat ve yenisini başlat</span>
      </Link>
    )
  }

  const left = block.deload - st.week
  return (
    <div className="stack">
      <Link to="/plan" className={`card tap blockstrip${st.deload ? ' deload' : ''}`} aria-label={`Blok: ${st.week}/${st.weeks}. hafta${st.deload ? ', deload haftası' : ''}, Plan'da aç`}>
        <span className="eyebrow">Blok: {st.week}/{st.weeks}. hafta</span>
        <span className="blockbar" aria-hidden="true">
          {Array.from({ length: st.weeks }, (_, i) => (
            <span key={i} className={`${i + 1 < st.week ? 'on' : ''}${i + 1 === st.week ? ' now' : ''}${i + 1 === block.deload ? ' dl' : ''}`} />
          ))}
        </span>
        <span className="sub">{st.deload ? 'Deload haftası' : left > 0 ? `Deload ${left} hafta sonra` : 'Deload haftası geçti'}</span>
      </Link>
      {st.deload && (
        <div className="card banner stack" role="status">
          <b className="banner-title">Bu hafta planlı deload</b>
          <div className="sub">
            Çalışma setlerini {deloadCutText()} azalt, ağırlığı koru ve RIR {deloadRirText()} ile bitir. Antrenman ekranı egzersiz başına
            önerilen set sayısını gösterir; hiçbir şey otomatik değişmez.
          </div>
        </div>
      )}
    </div>
  )
}
