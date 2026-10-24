import { t } from '../i18n/index.ts'
import { useState } from 'react'
import { shareSummaryCard, type CardName } from '../lib/summaryCard.ts'
import { useExercises } from '../lib/useExercises.ts'
import type { Workout } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

interface Props {
  workout: Workout
  /** Bu antrenmanda rekor kırılan egzersizler. */
  prs: CardName[]
  className?: string
}

/** Antrenman özet kartını PNG olarak paylaşır (paylaşım menüsü yoksa indirir). Bitiş özetinde ve geçmiş detayında ortak. */
export function ShareCardButton({ workout, prs, className = 'btn block' }: Props) {
  const { byId } = useExercises()
  const unit = useStore((s) => s.settings.unit)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const share = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const r = await shareSummaryCard(workout, { unit, prs, names: (id) => byId.get(id)?.name ?? id })
      if (r === 'downloaded') setMessage(t('shareCard.downloaded'))
    } catch {
      setMessage(t('shareCard.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className={className} onClick={() => void share()} disabled={busy}>
        {busy ? t('shareCard.preparing') : t('shareCard.share')}
      </button>
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </>
  )
}
