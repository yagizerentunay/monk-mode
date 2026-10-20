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
        <b className="banner-title">Verini güvene al: ana ekrana ekle</b>
        <div className="sub">
          iPhone'da sekmede açılan uygulamanın verisi, bir süre kullanılmazsa tarayıcı tarafından silinebilir.
          Ana ekrana eklenen uygulama bu temizlikten korunur.
        </div>
      </div>
      <ol className="sub" style={{ margin: 0, paddingLeft: 20 }}>
        <li>Ayarlar → "Yedeği kaydet (JSON)" ile yedek al.</li>
        <li>Paylaş menüsünden "Ana Ekrana Ekle"yi seç.</li>
        <li>Ana ekrandaki monk-mode'u aç; Ayarlar → "Yedekten yükle" ile yedeği içe aktar.</li>
      </ol>
      <p className="sub" style={{ margin: 0 }}>
        Ana ekran uygulaması ayrı depolama kullanır; yedeği yüklemezsen boş başlar.
      </p>
      <button
        className="btn small"
        onClick={() => {
          const at = Date.now()
          writeDismissedAt(at)
          setDismissed(at)
        }}
      >
        Anladım
      </button>
    </div>
  )
}
