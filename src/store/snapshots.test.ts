import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultState, type State } from './schema.ts'
import { listSnapshots, loadSnapshot, MAX_SNAPSHOTS, saveSnapshot } from './snapshots.ts'

function withWorkouts(n: number): State {
  const s = defaultState()
  s.workouts = Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    d: '2026-10-01',
    start: 1_000 + i,
    end: 2_000 + i,
    name: `Antrenman ${i}`,
    entries: [],
  }))
  return s
}

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('monk-mode')
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
})

describe('otomatik anlık kopyalar', () => {
  it('kopyayı yazar ve aynı veriyle geri yükler', async () => {
    const state = withWorkouts(2)
    expect(await saveSnapshot(state, 'Antrenman bitti', new Date(5_000))).toBe(true)
    expect(await listSnapshots()).toEqual([{ at: 5_000, reason: 'Antrenman bitti', workouts: 2 }])
    expect((await loadSnapshot(5_000)).workouts).toEqual(state.workouts)
  })

  it('son kopyayla aynı veriyi tekrar yazmaz', async () => {
    await saveSnapshot(withWorkouts(1), 'a', new Date(1_000))
    expect(await saveSnapshot(withWorkouts(1), 'b', new Date(2_000))).toBe(false)
    expect(await listSnapshots()).toHaveLength(1)
  })

  it(`en fazla ${MAX_SNAPSHOTS} kopya tutar, en eskiyi siler`, async () => {
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) await saveSnapshot(withWorkouts(i + 1), 'x', new Date(10_000 + i))
    const list = await listSnapshots()
    expect(list).toHaveLength(MAX_SNAPSHOTS)
    expect(list[0].at).toBe(10_000 + MAX_SNAPSHOTS + 2)
    expect(list.at(-1)!.at).toBe(10_003)
  })

  it('metni çağrı anında üretir: sonradan değişen state kopyayı etkilemez', async () => {
    const state = withWorkouts(3)
    const pending = saveSnapshot(state, 'Sıfırlamadan önce', new Date(7_000))
    state.workouts = []
    await pending
    expect((await loadSnapshot(7_000)).workouts).toHaveLength(3)
  })

  it('olmayan kopya için anlaşılır hata verir', async () => {
    await expect(loadSnapshot(123)).rejects.toThrow('Kopya bulunamadı.')
  })

  it('devam eden antrenman farklıysa aynı kayıtlı veriyle de yeni kopya yazılır', async () => {
    const plain = withWorkouts(1)
    await saveSnapshot(plain, 'Antrenman bitti', new Date(1_000))
    const withActive = { ...withWorkouts(1), active: { id: 'a', d: '2026-10-02', start: 5, name: 'Devam', entries: [] } }
    expect(await saveSnapshot(withActive, 'Devam eden antrenman silinmeden önce', new Date(2_000))).toBe(true)
    expect((await loadSnapshot(2_000)).active?.id).toBe('a')
  })
})
