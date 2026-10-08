import { useRef, useState } from 'react'
import { ImportCard } from '../components/ImportCard.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { DAY_NAMES } from '../lib/dates.ts'
import { REMIND_CHOICES } from '../lib/backupReminder.ts'
import { formatRate } from '../lib/bodyweight.ts'
import { PLATE_CHOICES } from '../lib/plates.ts'
import { unitToKg, type Unit } from '../lib/units.ts'
import { importBackup } from '../store/backup.ts'
import { downloadBackup } from '../store/downloadBackup.ts'
import { defaultState } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

/** Hedef hız seçenekleri, kullanıcının biriminde (kg/hafta ya da lb/hafta); saklanırken kg'a çevrilir. */
const GOAL_CHOICES: Record<Unit, number[]> = {
  kg: [-0.5, -0.25, 0, 0.25, 0.5],
  lb: [-1, -0.5, 0, 0.5, 1],
}

export function Settings() {
  const unit = useStore((s) => s.settings.unit)
  const restSec = useStore((s) => s.settings.restSec)
  const weekStart = useStore((s) => s.settings.weekStart)
  const plateKit = useStore((s) => s.settings.plateKit)
  const backupRemindDays = useStore((s) => s.settings.backupRemindDays)
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt)
  const bodyweightGoal = useStore((s) => s.settings.bodyweightGoal)
  const setSettings = useStore((s) => s.setSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const fileRef = useRef<HTMLInputElement>(null)
  const routineFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const download = () => {
    downloadBackup()
    setMessage('Yedek indirildi.')
  }

  const kit = plateKit[unit]
  const setKit = (patch: Partial<typeof kit>) =>
    setSettings({ plateKit: { ...plateKit, [unit]: { ...kit, ...patch } } })
  const togglePlate = (p: number) =>
    setKit({
      plates: (kit.plates.includes(p) ? kit.plates.filter((x) => x !== p) : [...kit.plates, p]).sort((a, b) => b - a),
    })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const state = importBackup(await file.text())
      if (!confirm('Mevcut tüm veriler yedekteki verilerle değiştirilsin mi?')) return
      replaceAll(state)
      // Veri az önce bir yedek dosyasından geldi; hemen ardından "yedekle" demek anlamsız olur.
      useStore.getState().markBackedUp(Date.now())
      setMessage(`Yedek yüklendi: ${state.workouts.length} antrenman, ${state.routines.length} rutin.`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Yedek dosyasından yalnız rutinleri ekler; antrenmanlara, ayarlara ve programa dokunmaz. */
  const onRoutineFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const incoming = importBackup(await file.text())
      const m = useStore.getState().addRoutinesFrom(incoming)
      const parts = [`${m.added} rutin eklendi`]
      if (m.skipped > 0) parts.push(`${m.skipped} zaten vardı`)
      if (m.invalid > 0) parts.push(`${m.invalid} geçersiz rutin atlandı`)
      setMessage(m.added + m.skipped + m.invalid === 0 ? 'Dosyada rutin bulunamadı.' : `${parts.join(', ')}.`)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (routineFileRef.current) routineFileRef.current.value = ''
    }
  }

  return (
    <div className="stack settings">
      <div>
        <div className="eyebrow">Tercihler ve veri</div>
        <h1 className="display">Ayarlar</h1>
      </div>

      <div className="card stack">
        <div className="eyebrow">Genel</div>
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
        <div className="eyebrow">Salon</div>
        <h2>Bar ve plakalar ({unit})</h2>
        <div className="row between">
          <span>Bar ağırlığı ({unit})</span>
          <div style={{ width: 90 }}>
            <NumberField label="Bar ağırlığı" value={kit.bar} step={0.5} onChange={(v) => setKit({ bar: Math.min(v, 100) })} />
          </div>
        </div>
        <div>
          <div className="sub" style={{ marginBottom: 6 }}>Eldeki plakalar (her çeşitten istediğin kadar)</div>
          <div className="row wrap">
            {PLATE_CHOICES[unit].map((p) => (
              <button
                key={p}
                className={`chip${kit.plates.includes(p) ? ' on' : ''}`}
                aria-pressed={kit.plates.includes(p)}
                onClick={() => togglePlate(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="eyebrow">Vücut</div>
        <h2>Kilo hedefi</h2>
        <p className="sub" style={{ margin: 0 }}>
          Haftalık hedef değişim hızı. Ana Sayfa ve İstatistik'te gerçek hızınla karşılaştırılır.
        </p>
        <div className="chips">
          <button
            className={`chip${bodyweightGoal === undefined ? ' on' : ''}`}
            aria-pressed={bodyweightGoal === undefined}
            onClick={() => setSettings({ bodyweightGoal: undefined })}
          >
            Yok
          </button>
          {GOAL_CHOICES[unit].map((v) => {
            const kg = unitToKg(v, unit)
            const on = bodyweightGoal !== undefined && Math.abs(bodyweightGoal - kg) < 0.005
            return (
              <button key={v} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setSettings({ bodyweightGoal: kg })}>
                {v === 0 ? 'Koru' : formatRate(kg, unit)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card stack">
        <div className="eyebrow">Yedek</div>
        <h2>Veri ve yedek</h2>
        <p className="sub" style={{ margin: 0 }}>
          Veriler yalnızca bu tarayıcıda durur. Tarayıcı verisini temizlersen kaybolur; düzenli yedek al.
        </p>
        <div className="sub" style={{ margin: 0 }}>
          Son yedek: {lastBackupAt ? new Date(lastBackupAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : 'hiç alınmadı'}
        </div>
        <button className="btn block" onClick={download}>Yedeği indir (JSON)</button>
        <div className="row between">
          <span>Yedek hatırlatması</span>
          <div className="chips">
            {REMIND_CHOICES.map((d) => (
              <button
                key={d}
                className={`chip${backupRemindDays === d ? ' on' : ''}`}
                aria-pressed={backupRemindDays === d}
                onClick={() => setSettings({ backupRemindDays: d })}
              >
                {d === 0 ? 'Kapalı' : `${d} gün`}
              </button>
            ))}
          </div>
        </div>
        <button className="btn block" onClick={() => fileRef.current?.click()}>Yedekten yükle</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className="btn block" onClick={() => routineFileRef.current?.click()}>Yedekten yalnız rutinleri ekle</button>
        <p className="sub" style={{ margin: 0 }}>Mevcut antrenmanların ve ayarların değişmez; dosyadaki rutinler üstüne eklenir.</p>
        <input ref={routineFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onRoutineFile(e.target.files?.[0])} />
        {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
      </div>

      <div className="card stack dangerzone">
        <div className="eyebrow danger">Tehlikeli bölge</div>
        <p className="sub" style={{ margin: 0 }}>Tüm antrenmanlar, rutinler ve ayarlar bu tarayıcıdan silinir. Önce yedek al.</p>
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
      </div>

      <ImportCard />

      <p className="sub">
        monk-mode · MIT lisanslı. Egzersiz verisi: free-exercise-db (kamu malı).
      </p>
    </div>
  )
}
