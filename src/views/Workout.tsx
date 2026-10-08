import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { ExerciseBrowser } from '../components/ExerciseBrowser.tsx'
import { PlateauNote } from '../components/PlateauNote.tsx'
import { PlateCalculator } from '../components/PlateCalculator.tsx'
import { RestTimer } from '../components/RestTimer.tsx'
import { Seal } from '../components/Brand.tsx'
import { SetRow } from '../components/SetRow.tsx'
import { SwapSheet } from '../components/SwapSheet.tsx'
import { formatClock } from '../lib/alert.ts'
import { formatShortDay } from '../lib/calendar.ts'
import { DAY_NAMES } from '../lib/dates.ts'
import { imageUrl, isUnilateralName, nameLang } from '../lib/exercises.ts'
import { describeSets, MAX_WARMUPS } from '../lib/intensity.ts'
import { lastNoteFor, NOTE_MAX } from '../lib/notes.ts'
import { plateTargets } from '../lib/plates.ts'
import { loadRest, saveRest } from '../lib/restState.ts'
import { formatSet } from '../lib/sets.ts'
import { hasCompletedWork } from '../lib/swap.ts'
import { groupLetter, restAfter, supersetInfo } from '../lib/superset.ts'
import { formatWeight } from '../lib/units.ts'
import { useExercises } from '../lib/useExercises.ts'
import { doneSetCount, isPR, lastEntryFor, partialSetCount, workoutVolume } from '../lib/workout.ts'
import type { Workout as WorkoutT } from '../store/schema.ts'
import { useStore } from '../store/useStore.ts'

interface Summary {
  workout: WorkoutT
  prs: { name: string; lang?: 'en' }[]
}

function Starter() {
  const routines = useStore((s) => s.routines)
  const week = useStore((s) => s.week)
  const start = useStore((s) => s.startWorkout)
  const navigate = useNavigate()
  const [today] = useState(() => new Date().getDay())
  const todayId = week[today]

  return (
    <div className="stack wk">
      <div>
        <div className="eyebrow">Antrenmanı başlat</div>
        <h1 className="display">Bir rutin seç<span className="hl">ve başla.</span></h1>
      </div>
      {routines.length === 0 && (
        <div className="card stack">
          <p className="sub" style={{ margin: 0 }}>Henüz rutinin yok.</p>
          <button className="btn primary" onClick={() => navigate('/plan')}>Rutin oluştur</button>
        </div>
      )}
      {routines.map((r) => (
        <button
          key={r.id}
          className={`card tap row between starter${r.id === todayId ? ' today' : ''}`}
          onClick={() => start(r.id)}
        >
          <div>
            {r.id === todayId && <div className="eyebrow">Bugün · {DAY_NAMES[today]}</div>}
            <div className="exname">{r.name}</div>
            <div className="sub">{r.ex.length} egzersiz</div>
          </div>
          <span className={r.id === todayId ? 'badge on' : 'badge'}>Başla ▶</span>
        </button>
      ))}
    </div>
  )
}

export function Workout() {
  const active = useStore((s) => s.active)
  const workouts = useStore((s) => s.workouts)
  const unit = useStore((s) => s.settings.unit)
  const restSec = useStore((s) => s.settings.restSec)
  const {
    updateSet,
    updateSide,
    toggleUnilateral,
    toggleSuperset,
    setEntryNote,
    setWorkoutNote,
    addSet,
    addWarmup,
    addDrop,
    removeSet,
    addExerciseToActive,
    swapExercise,
    finishWorkout,
    discardWorkout,
  } = useStore.getState()
  const { byId } = useExercises()
  const navigate = useNavigate()

  /** Bitiş zamanı localStorage'da da tutulur: sayfa yenilenince ya da başka sekmeden dönünce sayaç sürer. */
  const [restEnds, setRestEndsState] = useState<number | null>(() => (active ? loadRest(active.id, Date.now()) : null))
  const setRestEnds = (endsAt: number | null) => {
    setRestEndsState(endsAt)
    if (active) saveRest(active.id, endsAt)
  }
  const [now, setNow] = useState(() => Date.now())
  const [picking, setPicking] = useState(false)
  /** Değiştir sayfası açık olan egzersizin sırası. */
  const [swapEntryIdx, setSwapEntryIdx] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  /** Plaka hesaplayıcısı açık olan egzersizin sırası. */
  const [plateEntry, setPlateEntry] = useState<number | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  /** Not alanı elle açılan egzersizlerin sırası (notu olanlar zaten görünür). */
  const [noteOpen, setNoteOpen] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  if (summary) {
    const { workout, prs } = summary
    const mins = Math.max(1, Math.round(((workout.end ?? workout.start) - workout.start) / 60000))
    return (
      <div className="stack wk">
        <div className="wk-done-head">
          <Seal size={44} />
          <div>
            <div className="eyebrow done">Antrenman bitti</div>
            <h1 className="display">Tamamlandı<span className="hl">Bugün güçlendin.</span></h1>
          </div>
        </div>
        <div className="card stack wk-stats">
          <div className="row between"><span className="sub">Süre</span><b>{mins} dk</b></div>
          <div className="row between"><span className="sub">Tamamlanan set</span><b>{doneSetCount(workout).done}</b></div>
          {partialSetCount(workout) > 0 && (
            <div className="row between"><span className="sub">Yarım set (tek taraf)</span><b>{partialSetCount(workout)}</b></div>
          )}
          <div className="row between"><span className="sub">Toplam hacim</span><b>{formatWeight(workoutVolume(workout), unit)} {unit}</b></div>
        </div>
        {prs.length > 0 && (
          <div className="card stack wk-pr">
            <div className="eyebrow">Yeni rekorlar</div>
            {prs.map((p) => <div key={p.name} className="wk-pr-item" lang={p.lang}>{p.name}</div>)}
          </div>
        )}
        <button className="btn primary block" onClick={() => navigate('/')}>Ana sayfaya dön</button>
      </div>
    )
  }

  if (!active) return <Starter />

  const { done, total } = doneSetCount(active)
  const elapsed = (now - active.start) / 1000
  const groups = supersetInfo(active.entries.map((e) => e.linked))

  const finish = () => {
    const unfinished = total - done
    if (unfinished > 0 && !confirm(`${unfinished} set tamamlanmadı. Yine de bitirilsin mi?`)) return
    const prs = active.entries
      .filter((e) => isPR(workouts, { ...e, sets: e.sets.filter((x) => x.done) }))
      .map((e) => ({ name: byId.get(e.exId)?.name ?? e.exId, lang: nameLang(byId.get(e.exId)) }))
    const finished = finishWorkout()
    setRestEnds(null)
    if (finished) setSummary({ workout: finished, prs })
    else navigate('/')
  }

  return (
    <div className={`stack wk${restEnds ? ' resting' : ''}`}>
      <div className="row between wk-top">
        <button className="wk-back" onClick={() => navigate('/')}>← Antrenmana dön</button>
        <div className="row">
          <span className="wk-live"><i aria-hidden="true">●</i> Aktif</span>
          <button className="btn small" onClick={() => setMenu(true)} aria-label="Menü">⋯</button>
        </div>
      </div>
      <h1 className="wk-title">{active.name}</h1>
      <div className="row between wk-meta">
        <span className="wk-clock bignum">{formatClock(elapsed)}</span>
        <span className="sub"><b>{done} / {total}</b> çalışma seti</span>
      </div>
      <div className="progress"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>

      {active.entries.map((entry, ei) => {
        const ex = byId.get(entry.exId)
        const last = lastEntryFor(workouts, entry.exId)
        const lastTop = last?.sets.filter((s) => s.done && !s.warmup && !s.drop).sort((a, b) => b.w - a.w)[0]
        const lastNote = lastNoteFor(workouts, entry.exId)
        // Hedef: ilk yapılmamış çalışma setinin (ilerleme önerisi dahil) ağırlık × tekrarı.
        const targetSet = entry.sets.find((s) => !s.done && !s.warmup && !s.drop)
        // Sıradaki set: tüm antrenmanda yapılmamış ilk çalışma/dropset (ısınma dahil değil).
        const nextEi = active.entries.findIndex((e) => e.sets.some((s) => !s.done))
        const nextSi = ei === nextEi ? entry.sets.findIndex((s) => !s.done) : -1
        return (
          <div key={ei} className={`card stack excard${groups[ei] ? ' ss' : ''}`}>
            <div className="row">
              {ex?.images[0] && <img className="thumb" src={imageUrl(ex.images[0])} alt="" loading="lazy" />}
              <div className="grow">
                <div className="eyebrow">
                  Egzersiz {String(ei + 1).padStart(2, '0')} / {String(active.entries.length).padStart(2, '0')}
                  {groups[ei] && <> · Süperset {groupLetter(groups[ei].group)}{groups[ei].pos + 1}</>}
                </div>
                <div className="exname exhead" lang={nameLang(ex)}>{ex?.name ?? entry.exId}</div>
                <div className="sub">
                  {lastTop ? `Önceki seans: ${formatSet(lastTop, `${formatWeight(lastTop.w, unit)} ${unit}`)}` : 'İlk kez'}
                </div>
                {targetSet && lastTop && (
                  <div className="extarget">
                    Hedef {formatWeight(targetSet.w, unit)} {unit} × {targetSet.sides ? `${targetSet.sides.L.r}/${targetSet.sides.R.r}` : targetSet.r}
                  </div>
                )}
                <PlateauNote exId={entry.exId} />
                {lastNote && <div className="warntext">Not ({formatShortDay(lastNote.d)}): {lastNote.note}</div>}
              </div>
            </div>
            {(noteOpen.has(ei) || !!entry.note) && (
              <input
                className="input"
                aria-label={`${ex?.name ?? entry.exId} notu`}
                placeholder="Not: ağrı, takılma, enerji…"
                maxLength={NOTE_MAX}
                value={entry.note ?? ''}
                onChange={(e) => setEntryNote(ei, e.target.value)}
              />
            )}

            {entry.unilateral ? (
              <div className="setcols side" aria-hidden="true">
                <span>Set</span>
                <span>{unit === 'kg' ? 'KG' : unit.toUpperCase()} · Tekrar (taraf başına)</span>
                <span>Sonuç</span>
              </div>
            ) : (
              <div className="setcols" aria-hidden="true">
                <span>Set</span>
                <span>{unit === 'kg' ? 'KG' : unit.toUpperCase()}</span>
                <span>Tekrar</span>
                <span>Sonuç</span>
              </div>
            )}
            {(() => {
              const meta = describeSets(entry.sets)
              return entry.sets.map((set, si) => (
                <SetRow
                  key={si}
                  active={si === nextSi}
                  name={meta[si].name}
                  badge={meta[si].badge}
                  kind={meta[si].kind}
                  canDrop={meta[si].canDrop}
                  set={set}
                  unilateral={!!entry.unilateral}
                  unit={unit}
                  onChange={(patch) => updateSet(ei, si, patch)}
                  onSide={(side, patch) => updateSide(ei, si, side, patch)}
                  onDrop={() => addDrop(ei, si)}
                  onRemove={() => removeSet(ei, si)}
                  onCompleted={() => {
                    const rest = restAfter(active.entries, ei, si, restSec)
                    if (rest !== null) setRestEnds(Date.now() + rest * 1000)
                  }}
                />
              ))
            })()}

            <div className="row wrap exactions">
              <button className="btn small" onClick={() => addSet(ei)}>+ Set ekle</button>
              <button
                className="btn small"
                disabled={entry.sets.filter((s) => s.warmup).length >= MAX_WARMUPS}
                onClick={() => addWarmup(ei)}
              >
                + Isınma
              </button>
              <button className="btn small" onClick={() => setPlateEntry(ei)}>Plakalar</button>
              {ex && !hasCompletedWork(entry) && (
                <button className="btn small" onClick={() => setSwapEntryIdx(ei)}>Değiştir</button>
              )}
              {ei > 0 && (
                <button
                  className={`chip${entry.linked ? ' on' : ''}`}
                  aria-pressed={!!entry.linked}
                  onClick={() => toggleSuperset(ei)}
                >
                  Süperset (öncekiyle)
                </button>
              )}
              <button
                className={`chip${entry.unilateral ? ' on' : ''}`}
                aria-pressed={!!entry.unilateral}
                onClick={() => toggleUnilateral(ei)}
              >
                Tek taraflı (sol/sağ)
              </button>
              <button
                className={`chip${entry.note ? ' on' : ''}`}
                aria-pressed={noteOpen.has(ei) || !!entry.note}
                onClick={() =>
                  setNoteOpen((s) => {
                    const next = new Set(s)
                    if (next.has(ei)) next.delete(ei)
                    else next.add(ei)
                    return next
                  })
                }
              >
                Not
              </button>
            </div>
            {hasCompletedWork(entry) && (
              <div className="sub exswaphint">Tamamlanmış set var; egzersizi değiştirmek için önce setlerin işaretini geri al.</div>
            )}
          </div>
        )
      })}

      <button className="btn block" onClick={() => setPicking(true)}>+ Egzersiz ekle</button>
      <button className="btn primary block wk-finish" onClick={finish}>Bitir ✓</button>

      {restEnds && <RestTimer endsAt={restEnds} onChange={setRestEnds} />}

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Egzersiz ekle">
        <ExerciseBrowser
          actionLabel="Ekle"
          onSelect={(ex) => {
            addExerciseToActive(ex.id, { side: isUnilateralName(ex.name) })
            setPicking(false)
          }}
        />
      </BottomSheet>

      <BottomSheet open={swapEntryIdx !== null} onClose={() => setSwapEntryIdx(null)} title="Egzersizi değiştir">
        {swapEntryIdx !== null && active.entries[swapEntryIdx] && byId.get(active.entries[swapEntryIdx].exId) && (
          <SwapSheet
            current={byId.get(active.entries[swapEntryIdx].exId)!}
            excludeIds={new Set(active.entries.map((e) => e.exId))}
            onSelect={(next) => {
              swapExercise(swapEntryIdx, next.id, isUnilateralName(next.name))
              setSwapEntryIdx(null)
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet open={plateEntry !== null} onClose={() => setPlateEntry(null)} title="Plaka hesaplayıcı">
        {plateEntry !== null && active.entries[plateEntry] && (
          <PlateCalculator
            initialKg={plateTargets(active.entries[plateEntry].sets).initial}
            weights={plateTargets(active.entries[plateEntry].sets).weights}
          />
        )}
      </BottomSheet>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Antrenman">
        <div className="stack">
          <label className="field">
            <span className="sub">Antrenman notu (enerji, uyku, belirti…)</span>
            <textarea
              className="input"
              rows={3}
              maxLength={NOTE_MAX}
              value={active.note ?? ''}
              onChange={(e) => setWorkoutNote(e.target.value)}
            />
          </label>
          <button
            className="btn danger block"
            onClick={() => {
              if (confirm('Bu antrenman silinsin mi? Kaydedilmeyecek.')) {
                discardWorkout()
                setRestEnds(null)
                setMenu(false)
              }
            }}
          >
            Antrenmanı at
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
