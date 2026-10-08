import { useMemo, useRef, useState } from 'react'
import { parseImport } from '../lib/importCsv.ts'
import type { ParsedImport } from '../lib/importTypes.ts'
import { buildImport } from '../lib/importWorkouts.ts'
import { buildMatcher } from '../lib/matchExercise.ts'
import type { Unit } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { useStore } from '../store/useStore.ts'

const FORMAT_LABEL = { strong: 'Strong', hevy: 'Hevy' } as const

/** Strong veya Hevy CSV dosyasını önizleyip onayla içe aktarır; veri yalnız bu tarayıcıya yazılır. */
export function ImportCard() {
  const workouts = useStore((s) => s.workouts)
  const customEx = useStore((s) => s.customEx)
  const appUnit = useStore((s) => s.settings.unit)
  const importWorkouts = useStore((s) => s.importWorkouts)
  const { list, loading } = useExercises()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [fileUnit, setFileUnit] = useState<Unit>(appUnit)
  const [message, setMessage] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  const matcher = useMemo(() => buildMatcher(list), [list])
  const unit = parsed?.unit ?? fileUnit
  const plan = useMemo(
    () => (parsed ? buildImport(parsed, unit, matcher, workouts, customEx) : null),
    [parsed, unit, matcher, workouts, customEx],
  )

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    setParsed(null)
    try {
      const result = parseImport(await file.text())
      if (result.workouts.length === 0) throw new Error('Dosyada içe aktarılabilir antrenman bulunamadı.')
      setParsed(result)
      setShowMap(false)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const commit = () => {
    if (!plan) return
    importWorkouts(plan.workouts, plan.newCustom)
    setMessage(
      `${plan.workouts.length} antrenman (${plan.sets} set) içe aktarıldı` +
        (plan.newCustom.length ? `, ${plan.newCustom.length} yeni özel egzersiz eklendi.` : '.'),
    )
    setParsed(null)
  }

  const matched = plan?.mappings.filter((m) => !m.custom).length ?? 0
  const first = parsed?.workouts[0]?.date
  const last = parsed?.workouts[parsed.workouts.length - 1]?.date

  return (
    <div className="card stack">
      <h2>Başka uygulamadan içe aktar</h2>
      <p className="sub" style={{ margin: 0 }}>
        Strong veya Hevy'nin CSV dışa aktarımını seç. Strong dosyası İngilizce dışa aktarılmış olmalı. Veri bu
        tarayıcıda kalır; aynı dosyayı ikinci kez yüklemek kayıtları çoğaltmaz.
      </p>
      <button className="btn block" disabled={loading} onClick={() => fileRef.current?.click()}>
        CSV dosyası seç
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {parsed && plan && (
        <div className="stack">
          <div className="row between">
            <span className="sub">Biçim</span>
            <b>{FORMAT_LABEL[parsed.format]}</b>
          </div>
          <div className="row between">
            <span className="sub">Antrenman</span>
            <b>{plan.workouts.length}{plan.duplicates > 0 ? ` (+${plan.duplicates} zaten kayıtlı)` : ''}</b>
          </div>
          <div className="row between">
            <span className="sub">Tarih aralığı</span>
            <b>{first} – {last}</b>
          </div>
          <div className="row between">
            <span className="sub">Set</span>
            <b>{plan.sets}</b>
          </div>
          <div className="row between">
            <span className="sub">Ağırlık birimi</span>
            {parsed.unit ? (
              <b>{parsed.unit} (dosyadan)</b>
            ) : (
              <div className="chips">
                {(['kg', 'lb'] as const).map((u) => (
                  <button key={u} className={`chip${fileUnit === u ? ' on' : ''}`} onClick={() => setFileUnit(u)}>
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!parsed.unit && (
            <p className="warntext" style={{ margin: 0 }}>
              Dosya ağırlık birimini söylemiyor. Yanlış seçersen tüm ağırlıklar kayar; emin değilsen Strong'da
              birimine bak.
            </p>
          )}
          <div className="sub">
            {matched} egzersiz kütüphaneyle eşleşti, {plan.newCustom.length} tanesi özel egzersiz olarak eklenecek.
            <button className="linkbtn" onClick={() => setShowMap((v) => !v)}>
              {showMap ? 'Gizle' : 'Eşleşmeleri gör'}
            </button>
          </div>
          {showMap && (
            <div className="importmap">
              {plan.mappings.map((m) => (
                <div key={m.exId + m.name} className="row between">
                  <span>{m.name}</span>
                  <span className={m.custom ? 'warntext' : 'sub'}>
                    {m.custom ? 'yeni özel' : `→ ${m.target}`} · {m.sets}
                  </span>
                </div>
              ))}
            </div>
          )}
          {parsed.warnings.map((w) => (
            <p key={w} className="warntext" style={{ margin: 0 }}>{w}</p>
          ))}
          <div className="row">
            <button className="btn primary grow" disabled={plan.workouts.length === 0} onClick={commit}>
              İçe aktar
            </button>
            <button className="btn grow" onClick={() => setParsed(null)}>Vazgeç</button>
          </div>
        </div>
      )}
      {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
    </div>
  )
}
