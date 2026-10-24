import { t } from '../i18n/index.ts'
import { useState } from 'react'
import {
  currentEnv,
  readDismissedAt,
  shouldSuggestHomeScreen,
  writeDismissedAt,
} from '../lib/homeScreenHint.ts'
import { useStore } from '../store/useStore.ts'

/**
 * Ana sayfada, iPhone/iPad'de sekmede çalışan ve kaydı olan kullanıcıya: ana ekrana eklenen uygulamanın
 * verisi, kullanılmayan sekmenin verisi gibi tarayıcı tarafından silinmez (bkz. lib/homeScreenHint.ts).
 * Ana ekran uygulaması sekmeden ayrı depolama kullandığı için taşıma yolu yedektir; adımlar bunu söyler.
 */
export function HomeScreenHint() {
  const workouts = useStore((s) => s.workouts.length)
  const [now] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(readDismissedAt)

  if (!shouldSuggestHomeScreen(currentEnv(), workouts, dismissed, now)) return null

  return (
    <div className="card banner stack" role="note">
      <div>
        <b className="banner-title">{t('homeHint.title')}</b>
        <div className="sub">{t('homeHint.body')}</div>
      </div>
      <ol className="sub" style={{ margin: 0, paddingLeft: 20 }}>
        <li>{t('homeHint.step1')}</li>
        <li>{t('homeHint.step2')}</li>
        <li>{t('homeHint.step3')}</li>
      </ol>
      <p className="sub" style={{ margin: 0 }}>
        {t('homeHint.separate')}
      </p>
      <button
        className="btn small"
        onClick={() => {
          const at = Date.now()
          writeDismissedAt(at)
          setDismissed(at)
        }}
      >
        {t('common.gotIt')}
      </button>
    </div>
  )
}
