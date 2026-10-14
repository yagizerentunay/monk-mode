import { formatShortDay } from '../lib/calendar.ts'
import { formatLoadWithUnit, formatTimedLoad } from '../lib/load.ts'
import { isRecentRecord, RECENT_RECORD_DAYS, type ExerciseRecord, type RecordSet } from '../lib/records.ts'
import { formatSet } from '../lib/sets.ts'
import { formatWeight, type Unit } from '../lib/units.ts'

/** Varsayılan olarak en fazla kaç rekor satırı gösterilir; kalanı "Tümünü gör" ile açılır. */
export const RECORDS_LIMIT = 8

interface Props {
  records: ExerciseRecord[]
  /** Egzersiz kimliğinin görünen adı (özel, eski ve kütüphane egzersizleri); çözülemezse kimlik. */
  nameOf: (exId: string) => string
  unit: Unit
  today: Date
  showAll: boolean
  onToggleAll: () => void
  /** Satıra dokununca egzersiz detayını açar. */
  onOpen: (exId: string) => void
}

/** "60 kg×8 @2", vücut ağırlığında "+10 kg×5" ya da "Vücut ağırlığı×25"; süreli sette "45 sn". */
function setText(r: ExerciseRecord, s: RecordSet, unit: Unit): string {
  const load = r.timed ? formatTimedLoad(r.bw, s.set.w, unit) : formatLoadWithUnit(r.bw, s.set.w, unit)
  return formatSet(s.set, load, r.timed)
}

/** Rekor listesi (hook yok, saf). Yeni rekorlar önde; son 30 günde kırılanlar rozetlidir. */
export function RecordsList({ records, nameOf, unit, today, showAll, onToggleAll, onOpen }: Props) {
  const shown = showAll ? records : records.slice(0, RECORDS_LIMIT)
  return (
    <div className="stack">
      <div className="rec-list">
        {shown.map((r) => {
          const best = r.e1rm
          // En ağır set 1RM setiyle aynıysa ikinci satır tekrar etmez.
          const topSame = best !== undefined && best.set === r.top.set
          const recent = isRecentRecord(r.d, today)
          return (
            <button key={r.timed ? `${r.exId}-timed` : r.exId} type="button" className="exrow rec-row" onClick={() => onOpen(r.exId)}>
              <div className="grow">
                <div className="exname">
                  {nameOf(r.exId)}
                  {recent && <span className="rec-new"> Son {RECENT_RECORD_DAYS} günde yeni</span>}
                </div>
                {best && (
                  <div className="sub">
                    1RM ≈ {formatWeight(best.value, unit)} {unit} · {setText(r, best, unit)} · {formatShortDay(best.d, today)}
                  </div>
                )}
                {!topSame && (
                  <div className="sub">
                    {best ? 'En ağır' : r.timed ? 'En uzun' : 'En iyi'}: {setText(r, r.top, unit)} · {formatShortDay(r.top.d, today)}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {records.length > RECORDS_LIMIT && (
        <button type="button" className="btn small" aria-expanded={showAll} onClick={onToggleAll}>
          {showAll ? 'Daha az göster' : `Tümünü gör (${records.length})`}
        </button>
      )}
    </div>
  )
}
