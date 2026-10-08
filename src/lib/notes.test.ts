import { describe, expect, it } from 'vitest'
import type { Workout } from '../store/schema.ts'
import { cleanNote, lastNoteFor, NOTE_MAX } from './notes.ts'

const wk = (d: string, entries: { exId: string; note?: string }[]): Workout => ({
  id: d,
  d,
  start: Date.parse(d),
  name: 't',
  entries: entries.map((e) => ({ exId: e.exId, note: e.note, sets: [{ w: 1, r: 1, done: true }] })),
})

describe('not temizleme', () => {
  it('kırpar, boşu undefined yapar, uzunu keser', () => {
    expect(cleanNote('  sol omuz sızladı  ')).toBe('sol omuz sızladı')
    expect(cleanNote('   ')).toBeUndefined()
    expect(cleanNote(undefined)).toBeUndefined()
    expect(cleanNote('a'.repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX)
  })

  it('iç boşlukları korur', () => {
    expect(cleanNote('sol  omuz\nsızı')).toBe('sol  omuz\nsızı')
  })
})

describe('son not', () => {
  it('egzersizin en yeni notunu tarihiyle verir', () => {
    const w = [
      wk('2026-10-01', [{ exId: 'bench', note: 'eski' }]),
      wk('2026-10-05', [{ exId: 'bench', note: 'omuz sızısı' }]),
      wk('2026-10-06', [{ exId: 'row' }]),
    ]
    expect(lastNoteFor(w, 'bench')).toEqual({ note: 'omuz sızısı', d: '2026-10-05' })
  })

  it('başka egzersizin notunu karıştırmaz', () => {
    const w = [wk('2026-10-01', [{ exId: 'row', note: 'bel' }])]
    expect(lastNoteFor(w, 'bench')).toBeUndefined()
  })

  it('yalnız egzersizin son 3 seansına bakar: eski not unutulur', () => {
    const w = [
      wk('2026-09-01', [{ exId: 'bench', note: 'çok eski' }]),
      wk('2026-09-08', [{ exId: 'bench' }]),
      wk('2026-09-15', [{ exId: 'bench' }]),
      wk('2026-09-22', [{ exId: 'bench' }]),
    ]
    expect(lastNoteFor(w, 'bench')).toBeUndefined()
    expect(lastNoteFor(w, 'bench', 4)).toEqual({ note: 'çok eski', d: '2026-09-01' })
  })

  it('egzersizi içermeyen antrenmanları seans saymaz', () => {
    const w = [
      wk('2026-09-01', [{ exId: 'bench', note: 'not' }]),
      wk('2026-09-08', [{ exId: 'row' }]),
      wk('2026-09-15', [{ exId: 'row' }]),
      wk('2026-09-22', [{ exId: 'row' }]),
    ]
    expect(lastNoteFor(w, 'bench')?.note).toBe('not')
  })

  it('boş listede undefined verir', () => {
    expect(lastNoteFor([], 'bench')).toBeUndefined()
  })
})
