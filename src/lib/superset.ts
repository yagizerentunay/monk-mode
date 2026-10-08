import type { SetEntry, WorkoutEntry } from '../store/schema.ts'
import { restAfterSec } from './intensity.ts'

/** Bir egzersizin süperset içindeki yeri. */
export interface SupersetInfo {
  /** Seansın/rutinin süpersetleri arasında 0'dan sıra; "A", "B" … etiketi için. */
  group: number
  /** Grup içindeki sıra (0'dan). */
  pos: number
  size: number
}

/**
 * Egzersiz başına "öncekiyle bağlı" bayraklarından süperset gruplarını çıkarır. Ardışık bağlı
 * egzersizler tek gruptur (ikili süperset, üçlü, dev set). Tek başına kalan egzersiz ve ilk
 * egzersizin bayrağı süperset sayılmaz; o yüzden null döner.
 */
export function supersetInfo(linked: (boolean | undefined)[]): (SupersetInfo | null)[] {
  const out: (SupersetInfo | null)[] = linked.map(() => null)
  let group = 0
  let start = 0
  while (start < linked.length) {
    let end = start
    while (end + 1 < linked.length && linked[end + 1]) end++
    const size = end - start + 1
    if (size > 1) {
      for (let k = 0; k < size; k++) out[start + k] = { group, pos: k, size }
      group++
    }
    start = end + 1
  }
  return out
}

/** "A", "B" … ; 26'dan sonrası için tekrarlı harf ("AA"). */
export function groupLetter(group: number): string {
  let n = group
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

const isWork = (s: SetEntry) => !s.warmup && !s.drop

/** `index`'inci setin ait olduğu çalışma seti sırası; drop kendinden önceki çalışma setine aittir. */
function workIndex(sets: SetEntry[], index: number): number {
  let n = -1
  for (let i = 0; i <= index; i++) if (isWork(sets[i])) n++
  return Math.max(0, n)
}

/**
 * `entryIdx` egzersizinin `setIdx`'inci seti bitince kaç saniye dinlenilecek; null = sayaç yok.
 * Egzersiz içi kurallar (ısınma kısa, drop öncesi yok) aynen geçerlidir. Süpersette ek olarak,
 * gruptaki sonraki egzersizin aynı sıradaki çalışma seti hâlâ yapılmamışsa dinlenmeden ona geçilir;
 * dinlenme turun sonunda (son egzersiz ya da partnerin o seti yoksa/bitmişse) başlar.
 */
export function restAfter(
  entries: WorkoutEntry[],
  entryIdx: number,
  setIdx: number,
  restSec: number,
): number | null {
  const entry = entries[entryIdx]
  const base = restAfterSec(entry.sets, setIdx, restSec)
  if (base === null) return null
  if (entry.sets[setIdx].warmup) return base

  const info = supersetInfo(entries.map((e) => e.linked))[entryIdx]
  if (!info) return base

  const n = workIndex(entry.sets, setIdx)
  const last = entryIdx + (info.size - info.pos - 1)
  for (let j = entryIdx + 1; j <= last; j++) {
    const partner = entries[j].sets.filter(isWork)[n]
    if (partner && !partner.done) return null
  }
  return base
}
