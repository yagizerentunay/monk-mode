import { useEffect, useState } from 'react'
import { t } from '../i18n/index.ts'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { decodeRoutine, ShareError, type SharedRoutine } from '../lib/routineShare.ts'
import { useExercises } from '../lib/useExercises.ts'
import { newId } from '../lib/workout.ts'
import type { ExCfg } from '../store/schema.ts'
import { useToast } from '../store/toast.ts'
import { useStore } from '../store/useStore.ts'

type Decoded = { shared: SharedRoutine } | { error: string } | null

/** Set × tekrar satırı; süreli harekette tekrar yerine saniye yazar. */
function planText(e: ExCfg): string {
  const range = e.reps === e.repsMax || e.prog !== 'double' ? `${e.reps}` : `${e.reps}–${e.repsMax}`
  return e.timed ? `${e.sets} × ${t('unit.secValue', { n: range })}` : `${e.sets} × ${range}`
}

/**
 * Paylaşım linki (`#/share/<payload>`) açılınca: rutinin önizlemesi ve "Rutinlerime ekle". Kütüphanede ya da
 * kullanıcının özel egzersizlerinde olmayan hareket, linkte tanımı varsa özel egzersiz olarak eklenir; yoksa
 * atlanır ve bu açıkça yazılır. Ekleme `addRoutinesFrom` (lib/mergeRoutines.ts) ile yapılır: mevcut rutinlere
 * dokunmaz, aynı adlı rutin varsa "(2)" ekiyle eklenir.
 */
export function ShareImport() {
  const { payload = '' } = useParams()
  const navigate = useNavigate()
  const addRoutinesFrom = useStore((s) => s.addRoutinesFrom)
  const { byId, loading } = useExercises({ legacy: true })
  const [decoded, setDecoded] = useState<Decoded>(null)

  useEffect(() => {
    let alive = true
    decodeRoutine(payload)
      .then((shared) => alive && setDecoded({ shared }))
      .catch((e: unknown) => alive && setDecoded({ error: e instanceof ShareError ? e.message : t('shareImport.openFailed') }))
    return () => {
      alive = false
    }
  }, [payload])

  if (decoded === null) return <p className="sub">{t('shareImport.opening')}</p>

  if ('error' in decoded) {
    return (
      <div className="stack">
        <div className="eyebrow">{t('shareImport.eyebrow')}</div>
        <p className="warntext" role="alert">{decoded.error}</p>
        <Link className="btn block" to="/plan">{t('shareImport.backToPlans')}</Link>
      </div>
    )
  }

  const { routine, customEx } = decoded.shared
  const sharedCustom = new Map(customEx.map((c) => [c.id, c]))
  const rows = routine.ex.map((e) => {
    const known = byId.get(e.exId)
    const custom = known ? undefined : sharedCustom.get(e.exId)
    return { cfg: e, name: known?.name ?? custom?.name ?? e.exId, status: known ? 'ok' : custom ? 'custom' : 'missing' } as const
  })
  const usable = rows.filter((r) => r.status !== 'missing')
  const missing = rows.length - usable.length
  const newCustom = rows.filter((r) => r.status === 'custom').length

  const add = () => {
    const id = newId()
    const used = new Set(usable.map((r) => r.cfg.exId))
    const result = addRoutinesFrom({
      routines: [{ ...routine, id, ex: usable.map((r) => r.cfg) }],
      customEx: customEx.filter((c) => used.has(c.id) && !byId.has(c.id)),
    })
    if (result.added === 0) return
    const name = result.routines.find((r) => r.id === id)?.name ?? routine.name
    useToast.getState().show(t('shareImport.added', { name }), () => useStore.getState().deleteRoutine(id))
    navigate(`/plan/r/${id}`, { replace: true })
  }

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{t('shareImport.eyebrow')}</div>
        <h1 className="display">{routine.name}</h1>
        <div className="sub">{t('count.exercises', { n: routine.ex.length })}</div>
      </div>
      <div className="card stack">
        <ol className="sharelist">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="exname">{r.name}</span> <span className="sub">· {planText(r.cfg)}</span>
              {!loading && r.status === 'custom' && <span className="sub"> · {t('shareImport.asCustom')}</span>}
              {!loading && r.status === 'missing' && <span className="warntext"> · {t('shareImport.missing')}</span>}
            </li>
          ))}
        </ol>
      </div>
      {!loading && missing > 0 && (
        <p className="warntext" role="status" style={{ margin: 0 }}>
          {usable.length === 0
            ? t('shareImport.noneUsable')
            : t('shareImport.someMissing', { n: missing, missing: t('shareImport.movements', { n: missing }), rest: t('shareImport.movements', { n: usable.length }) })}
        </p>
      )}
      {!loading && newCustom > 0 && (
        <p className="sub" style={{ margin: 0 }}>
          {t('shareImport.customNote', { n: newCustom, movements: t('shareImport.movements', { n: newCustom }) })}
        </p>
      )}
      <p className="sub" style={{ margin: 0 }}>
        {t('shareImport.unchanged')}
      </p>
      <button className="btn primary block" disabled={loading || usable.length === 0} onClick={add}>
        {loading ? t('shareImport.loadingLibrary') : t('shareImport.add')}
      </button>
      <Link className="btn block" to="/plan">{t('common.cancel')}</Link>
    </div>
  )
}
