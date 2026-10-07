import { useRef, useState } from 'react'
import { NumberField } from '../components/NumberField.tsx'
import { DAY_NAMES } from '../lib/dates.ts'
import { dayString } from '../lib/workout.ts'
import { exportBackup, importBackup } from '../store/backup.ts'
import { defaultState } from '../store/schema.ts'
import { snapshot, useStore } from '../store/useStore.ts'

export function Settings() {
  const unit = useStore((s) => s.settings.unit)
  const restSec = useStore((s) => s.settings.restSec)
  const weekStart = useStore((s) => s.settings.weekStart)
  const setSettings = useStore((s) => s.setSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const download = () => {
    const blob = new Blob([exportBackup(snapshot(useStore.getState()))], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monk-mode-yedek-${dayString()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Yedek indirildi.')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const state = importBackup(await file.text())
      if (!confirm('Mevcut tüm veriler yedekteki verilerle değiştirilsin mi?')) return
      replaceAll(state)
      setMessage(`Yedek yüklendi: ${state.workouts.length} antrenman, ${state.routines.length} rutin.`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="stack">
      <h1>Ayarlar</h1>

      <div className="card stack">
        <h2>Tercihler</h2>
        <div className="row between">
          <span>Birim</span>
          <div className="chips">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} className={`chip${unit === u ? ' on' : ''}`} onClick={() => setSettings({ unit: u })}>{u}</button>
            ))}
          </div>
        </div>
        <div className="row between">
          <span>Dinlenme süresi (sn)</span>
          <div style={{ width: 90 }}>
            <NumberField value={restSec} min={10} onChange={(v) => setSettings({ restSec: Math.round(v) })} />
          </div>
        </div>
        <div className="row between">
          <span>Hafta başlangıcı</span>
          <select
            className="input"
            style={{ width: 150 }}
            value={weekStart}
            onChange={(e) => setSettings({ weekStart: Number(e.target.value) })}
          >
            {[1, 0, 6].map((d) => (
              <option key={d} value={d}>{DAY_NAMES[d]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card stack">
        <h2>Veri ve yedek</h2>
        <p className="sub" style={{ margin: 0 }}>
          Veriler yalnızca bu tarayıcıda durur. Tarayıcı verisini temizlersen kaybolur; düzenli yedek al.
        </p>
        <button className="btn block" onClick={download}>Yedeği indir (JSON)</button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>Yedekten yükle</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          className="btn danger block"
          onClick={() => {
            if (confirm('Tüm veriler silinecek. Emin misin?')) {
              replaceAll(defaultState())
              setMessage('Tüm veriler sıfırlandı.')
            }
          }}
        >
          Her şeyi sıfırla
        </button>
        {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
      </div>

      <p className="sub">
        monk-mode · MIT lisanslı. Egzersiz verisi: free-exercise-db (kamu malı).
      </p>
    </div>
  )
}
