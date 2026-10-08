import { describe, expect, it } from 'vitest'
import type { Routine, Workout } from '../store/schema.ts'
import { draftForDate, insertWorkout, noonOf } from './backdate.ts'

const routine: Routine = {
  id: 'r1',
  name: 'A Günü',
  ex: [
    { exId: 'bench', sets: 2, reps: 5, weight: 60, prog: 'linear', inc: 2.5, repsMax: 8, warmups: 1 },
    { exId: 'curl', sets: 1, reps: 8, weight: 12, prog: 'off', inc: 1, repsMax: 12, side: true },
  ],
}
const wk = (id: string, d: string, w: number, start = Date.parse(d)): Workout => ({
  id,
  d,
  start,
  name: 't',
  entries: [{ exId: 'bench', sets: [{ w, r: 5, done: true }, { w, r: 5, done: true }] }],
})

describe('geçmiş gün taslağı', () => {
  it('seçilen tarihi ve öğle saatini kullanır, rutin bilgisini taşır', () => {
    const d = draftForDate(routine, [], '2026-10-05')
    expect(d.d).toBe('2026-10-05')
    expect(d.start).toBe(noonOf('2026-10-05'))
    expect(new Date(d.start).getHours()).toBe(12)
    expect(d).toMatchObject({ name: 'A Günü', routineId: 'r1' })
    expect(d.end).toBeUndefined()
  })

  it('tüm setleri yapılmış getirir (ısınma dahil), tek taraflıda iki tarafı da', () => {
    const d = draftForDate(routine, [], '2026-10-05')
    expect(d.entries[0].sets.every((s) => s.done)).toBe(true)
    expect(d.entries[0].sets.some((s) => s.warmup)).toBe(true)
    const curl = d.entries[1].sets[0]
    expect(curl.done).toBe(true)
    expect(curl.sides).toMatchObject({ L: { done: true }, R: { done: true } })
  })

  it('ilerleme önerisini yalnız o günden ÖNCEKİ antrenmanlardan alır', () => {
    // 1 Ekim'de 60 kg başarılı → öneri 62,5. 20 Ekim'de 100 kg yapılmış olsa da 5 Ekim'i etkilemez.
    const history = [wk('a', '2026-10-01', 60), wk('b', '2026-10-20', 100)]
    const d = draftForDate(routine, history, '2026-10-05')
    expect(d.entries[0].sets.find((s) => !s.warmup)!.w).toBe(62.5)
  })

  it('o gün ya da sonrasındaki antrenmanı geçmiş saymaz', () => {
    const d = draftForDate(routine, [wk('same', '2026-10-05', 80)], '2026-10-05')
    expect(d.entries[0].sets.find((s) => !s.warmup)!.w).toBe(60)
  })
})

describe('antrenman ekleme', () => {
  it('tarih ve başlangıç sırasına göre doğru yere koyar', () => {
    const list = [wk('a', '2026-10-01', 1), wk('c', '2026-10-09', 1)]
    const out = insertWorkout(list, wk('b', '2026-10-05', 1))
    expect(out.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('aynı gün birden fazla antrenmanı başlangıç saatine göre sıralar', () => {
    const list = [wk('late', '2026-10-05', 1, 2000)]
    expect(insertWorkout(list, wk('early', '2026-10-05', 1, 1000)).map((w) => w.id)).toEqual(['early', 'late'])
  })

  it('aynı kimliği ikinci kez eklemez, girdiyi değiştirmez', () => {
    const list = [wk('a', '2026-10-01', 1)]
    expect(insertWorkout(list, wk('a', '2026-10-02', 9))).toHaveLength(1)
    expect(list).toHaveLength(1)
  })
})
