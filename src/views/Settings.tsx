import { useEffect, useRef, useState } from 'react'
import { t, type LanguageSetting, type MessageKey } from '../i18n/index.ts'
import { ChipRow } from '../components/ChipRow.tsx'
import { CsvExportCard } from '../components/CsvExportCard.tsx'
import { DiagnosticsCard } from '../components/DiagnosticsCard.tsx'
import { FolderBackupCard } from '../components/FolderBackupCard.tsx'
import { ImportCard } from '../components/ImportCard.tsx'
import { MergeImportCard } from '../components/MergeImportCard.tsx'
import { MuscleTargetsCard } from '../components/MuscleTargetsCard.tsx'
import { NumberField } from '../components/NumberField.tsx'
import { ProgressionRuleCard } from '../components/ProgressionRuleCard.tsx'
import { SnapshotsCard } from '../components/SnapshotsCard.tsx'
import { formatDateTime } from '../lib/calendar.ts'
import { DAY_NAMES } from '../lib/dates.ts'
import { REMIND_CHOICES } from '../lib/backupReminder.ts'
import { formatRate } from '../lib/bodyweight.ts'
import { getPersistStatus, requestPersist, type PersistStatus } from '../lib/persistStorage.ts'
import { PLATE_CHOICES } from '../lib/plates.ts'
import { formatDecimal, unitToKg, type Unit } from '../lib/units.ts'
import { importBackupWithReport } from '../store/backup.ts'
import { describeDropped } from '../store/sanitize.ts'
import { snapshotNow } from '../store/autoSnapshot.ts'
import { shareBackup } from '../store/downloadBackup.ts'
import { defaultState, type Theme } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

/** Hedef hız seçenekleri, kullanıcının biriminde (kg/hafta ya da lb/hafta); saklanırken kg'a çevrilir. */
const GOAL_CHOICES: Record<Unit, number[]> = {
  kg: [-0.5, -0.25, 0, 0.25, 0.5],
  lb: [-1, -0.5, 0, 0.5, 1],
}

const THEME_CHOICES: [Theme, MessageKey][] = [
  ['system', 'settings.theme.system'],
  ['dark', 'settings.theme.dark'],
  ['light', 'settings.theme.light'],
]

/** Dil seçenekleri: dil adları her dilde kendi adıyla yazılır. */
const LANGUAGE_CHOICES: [LanguageSetting, MessageKey][] = [
  ['system', 'settings.language.system'],
  ['tr', 'settings.language.tr'],
  ['en', 'settings.language.en'],
]

export function Settings() {
  const unit = useStore((s) => s.settings.unit)
  const restSec = useStore((s) => s.settings.restSec)
  const weekStart = useStore((s) => s.settings.weekStart)
  const plateKit = useStore((s) => s.settings.plateKit)
  const backupRemindDays = useStore((s) => s.settings.backupRemindDays)
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt)
  const bodyweightGoal = useStore((s) => s.settings.bodyweightGoal)
  const theme = useStore((s) => s.settings.theme)
  const language = useStore((s) => s.settings.language)
  const setSettings = useStore((s) => s.setSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const fileRef = useRef<HTMLInputElement>(null)
  const routineFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [persist, setPersist] = useState<PersistStatus | null>(null)

  useEffect(() => {
    let alive = true
    void getPersistStatus().then((s) => {
      if (alive) setPersist(s)
    })
    return () => {
      alive = false
    }
  }, [])

  const askPersist = async () => {
    const s = await requestPersist()
    setPersist(s)
    if (s !== 'persisted') setMessage(t('settings.persistDenied'))
  }

  const download = async () => {
    const r = await shareBackup()
    if (r !== 'cancelled') setMessage(r === 'shared' ? t('settings.backupSaved') : t('settings.backupDownloaded'))
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
      const { state, report } = importBackupWithReport(await file.text())
      if (!confirm(t('settings.restoreConfirm'))) return
      void snapshotNow(t('snapshot.beforeRestore'))
      replaceAll(state)
      // Veri az önce bir yedek dosyasından geldi; hemen ardından "yedekle" demek anlamsız olur.
      useStore.getState().markBackedUp(Date.now())
      const skipped = describeDropped(report)
      setMessage(
        t('settings.restored', {
          workouts: t('count.workouts', { n: state.workouts.length }),
          routines: t('count.routines', { n: state.routines.length }),
          skipped: skipped ? `; ${skipped}` : '',
        }),
      )
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
      const { state: incoming, report } = importBackupWithReport(await file.text())
      void snapshotNow(t('snapshot.beforeAddRoutines'))
      const m = useStore.getState().addRoutinesFrom(incoming)
      const parts = [t('settings.routinesAdded', { n: m.added })]
      if (m.skipped > 0) parts.push(t('settings.routinesExisting', { n: m.skipped }))
      if (m.invalid > 0) parts.push(t('settings.routinesInvalid', { n: m.invalid }))
      // Rutin içe aktarımı yalnız rutinlere bakar; antrenman vb. bozuklukları sayıya karışmasın.
      const brokenRoutines = report.dropped.routine + report.dropped.routineEx
      if (brokenRoutines > 0) parts.push(t('sanitize.dropped', { n: brokenRoutines }))
      setMessage(
        m.added + m.skipped + m.invalid + brokenRoutines === 0 ? t('settings.noRoutinesInFile') : `${parts.join(', ')}.`,
      )
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (routineFileRef.current) routineFileRef.current.value = ''
    }
  }

  return (
    <div className="stack settings">
      <div>
        <div className="eyebrow">{t('settings.eyebrow')}</div>
        <h1 className="display">{t('settings.title')}</h1>
      </div>

      <div className="card stack">
        <div className="eyebrow">{t('settings.general')}</div>
        <h2>{t('settings.preferences')}</h2>
        <div className="row between">
          <span>{t('settings.unit')}</span>
          <ChipRow>
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} className={`chip${unit === u ? ' on' : ''}`} onClick={() => setSettings({ unit: u })}>{u}</button>
            ))}
          </ChipRow>
        </div>
        <div className="row between">
          <span>{t('settings.restSec')}</span>
          <div style={{ width: 90 }}>
            <NumberField label={t('settings.restSec')} value={restSec} min={10} onChange={(v) => setSettings({ restSec: Math.round(v) })} />
          </div>
        </div>
        <div className="row between">
          <span>{t('settings.weekStart')}</span>
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
        <div className="row between">
          <span>{t('settings.theme')}</span>
          <ChipRow>
            {THEME_CHOICES.map(([value, label]) => (
              <button key={value} className={`chip${theme === value ? ' on' : ''}`} aria-pressed={theme === value} onClick={() => setSettings({ theme: value })}>
                {t(label)}
              </button>
            ))}
          </ChipRow>
        </div>
        <div className="row between">
          <span>{t('settings.language')}</span>
          <ChipRow>
            {LANGUAGE_CHOICES.map(([value, label]) => (
              <button
                key={value}
                className={`chip${language === value ? ' on' : ''}`}
                aria-pressed={language === value}
                lang={value === 'system' ? undefined : value}
                onClick={() => setSettings({ language: value })}
              >
                {t(label)}
              </button>
            ))}
          </ChipRow>
        </div>
      </div>

      <div className="card stack">
        <div className="eyebrow">{t('settings.gym')}</div>
        <h2>{t('settings.barAndPlates', { unit })}</h2>
        <div className="row between">
          <span>{t('settings.barWeightUnit', { unit })}</span>
          <div style={{ width: 90 }}>
            <NumberField label={t('settings.barWeight')} value={kit.bar} step={0.5} onChange={(v) => setKit({ bar: Math.min(v, 100) })} />
          </div>
        </div>
        <div>
          <div className="sub" style={{ marginBottom: 6 }}>{t('settings.platesOnHand')}</div>
          <div className="row wrap">
            {PLATE_CHOICES[unit].map((p) => (
              <button
                key={p}
                className={`chip${kit.plates.includes(p) ? ' on' : ''}`}
                aria-pressed={kit.plates.includes(p)}
                onClick={() => togglePlate(p)}
              >
                {formatDecimal(p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="eyebrow">{t('settings.body')}</div>
        <h2>{t('settings.weightGoal')}</h2>
        <p className="sub" style={{ margin: 0 }}>
          {t('settings.weightGoalHint')}
        </p>
        <ChipRow>
          <button
            className={`chip${bodyweightGoal === undefined ? ' on' : ''}`}
            aria-pressed={bodyweightGoal === undefined}
            onClick={() => setSettings({ bodyweightGoal: undefined })}
          >
            {t('settings.none')}
          </button>
          {GOAL_CHOICES[unit].map((v) => {
            const kg = unitToKg(v, unit)
            const on = bodyweightGoal !== undefined && Math.abs(bodyweightGoal - kg) < 0.005
            return (
              <button key={v} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setSettings({ bodyweightGoal: kg })}>
                {v === 0 ? t('settings.maintain') : formatRate(kg, unit)}
              </button>
            )
          })}
        </ChipRow>
      </div>

      <ProgressionRuleCard />
      <MuscleTargetsCard />

      <div className="card stack">
        <div className="eyebrow">{t('settings.backupEyebrow')}</div>
        <h2>{t('settings.dataAndBackup')}</h2>
        <p className="sub" style={{ margin: 0 }}>
          {t('settings.dataHint')}
        </p>
        <div className="sub" style={{ margin: 0 }}>
          {t('settings.lastBackup', { when: lastBackupAt ? formatDateTime(lastBackupAt) : t('settings.never') })}
        </div>
        {persist && (
          <>
            <div className="row between">
              <span>{t('settings.persist')}</span>
              <span className="sub" style={{ margin: 0 }}>
                {persist === 'persisted' ? t('common.on') : persist === 'not-persisted' ? t('common.off') : t('common.unsupported')}
              </span>
            </div>
            {persist === 'not-persisted' && (
              <>
                <p className="sub" style={{ margin: 0 }}>
                  {t('settings.persistHint')}
                </p>
                <button className="btn block" onClick={() => void askPersist()}>{t('settings.persistAsk')}</button>
              </>
            )}
          </>
        )}
        <button className="btn block" onClick={() => void download()}>{t('settings.saveBackup')}</button>
        <div className="row between">
          <span>{t('settings.backupReminder')}</span>
          <ChipRow>
            {REMIND_CHOICES.map((d) => (
              <button
                key={d}
                className={`chip${backupRemindDays === d ? ' on' : ''}`}
                aria-pressed={backupRemindDays === d}
                onClick={() => setSettings({ backupRemindDays: d })}
              >
                {d === 0 ? t('settings.reminderOff') : t('count.days', { n: d })}
              </button>
            ))}
          </ChipRow>
        </div>
        <button className="btn block" onClick={() => fileRef.current?.click()}>{t('settings.restore')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <button className="btn block" onClick={() => routineFileRef.current?.click()}>{t('settings.addRoutinesFromBackup')}</button>
        <p className="sub" style={{ margin: 0 }}>{t('settings.addRoutinesHint')}</p>
        <input ref={routineFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onRoutineFile(e.target.files?.[0])} />
        {message && <p className="sub" role="status" style={{ margin: 0 }}>{message}</p>}
      </div>

      <FolderBackupCard />

      <CsvExportCard />

      <SnapshotsCard />

      <DiagnosticsCard />

      <div className="card stack dangerzone">
        <div className="eyebrow danger">{t('settings.dangerZone')}</div>
        <p className="sub" style={{ margin: 0 }}>{t('settings.resetHint')}</p>
        <button
          className="btn danger block"
          onClick={() => {
            if (confirm(t('settings.resetConfirm'))) {
              void snapshotNow(t('snapshot.beforeReset'))
              replaceAll(defaultState())
              setMessage(t('settings.resetDone'))
            }
          }}
        >
          {t('settings.reset')}
        </button>
      </div>

      <ImportCard />
      <MergeImportCard />

      <p className="sub">
        {t('settings.version', { version: __APP_VERSION__ })}
      </p>
      <p className="sub">
        {t('settings.exerciseData')}{' '}
        <a href="https://github.com/yagizerentunay/open-exercise-atlas" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
          Open Exercise Atlas
        </a>
      </p>
    </div>
  )
}
