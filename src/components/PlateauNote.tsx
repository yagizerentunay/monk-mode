import { t } from '../i18n/index.ts'
import { useMemo } from 'react'
import { detectPlateau } from '../lib/plateau.ts'
import { useStore } from '../store/useStore.ts'

/** Egzersizde ilerleme durduysa kısa bir uyarı ve öneri; aksi hâlde hiçbir şey çizmez. */
/** `onSwap` verilirse (egzersiz henüz değiştirilebiliyorsa) nottan egzersiz değiştirme sayfası açılır. */
export function PlateauNote({ exId, onSwap }: { exId: string; onSwap?: () => void }) {
  const workouts = useStore((s) => s.workouts)
  const plateau = useMemo(() => detectPlateau(workouts, exId), [workouts, exId])
  if (!plateau) return null
  return (
    <div className="warntext" role="note">
      {t('plateau.note', { sessions: t('count.sessions', { n: plateau.sessions }) })}
      {onSwap && (
        <>
          {' '}
          <button className="btn small" onClick={onSwap}>{t('plateau.swap')}</button>
        </>
      )}
    </div>
  )
}
