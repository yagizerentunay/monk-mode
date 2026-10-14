import { describe, expect, it } from 'vitest'
import type { Routine } from '../store/schema.ts'
import { copyName, duplicateRoutine } from './routineCopy.ts'

const source = (): Routine => ({
  id: 'r1',
  name: 'Push',
  ex: [
    { exId: 'bench', sets: 4, reps: 6, weight: 60, prog: 'linear', inc: 2.5, repsMax: 8, warmups: 2, drops: 1, restSec: 150 },
    { exId: 'fly', sets: 3, reps: 12, weight: 10, prog: 'double', inc: 1, repsMax: 15, superset: true, side: true },
    { exId: 'pullup', sets: 3, reps: 5, weight: -10, prog: 'off', inc: 0, repsMax: 5, bw: true },
  ],
})

describe('copyName', () => {
  it('"(kopya)" ekler', () => {
    expect(copyName('Push', ['Push'])).toBe('Push (kopya)')
  })

  it('ad doluysa sayaçla ilerler', () => {
    expect(copyName('Push', ['Push', 'Push (kopya)'])).toBe('Push (kopya 2)')
    expect(copyName('Push', ['Push', 'Push (kopya)', 'Push (kopya 2)'])).toBe('Push (kopya 3)')
  })

  it('ilk boş sayıyı kullanır', () => {
    expect(copyName('Push', ['Push', 'Push (kopya)', 'Push (kopya 3)'])).toBe('Push (kopya 2)')
  })

  it('büyük/küçük harf ve boşluktan bağımsız karşılaştırır', () => {
    expect(copyName('Push', ['push (KOPYA) '])).toBe('Push (kopya 2)')
  })

  it('kopyanın kopyası ek üst üste yığmaz', () => {
    expect(copyName('Push (kopya)', ['Push', 'Push (kopya)'])).toBe('Push (kopya 2)')
    expect(copyName('Push (kopya 2)', ['Push', 'Push (kopya)', 'Push (kopya 2)'])).toBe('Push (kopya 3)')
  })

  it('boş ad için de geçerli bir ad üretir', () => {
    expect(copyName('', [])).toBe('Rutin (kopya)')
  })
})

describe('duplicateRoutine', () => {
  it('yeni kimlik ve benzersiz adla tüm egzersiz ayarlarını taşır', () => {
    const src = source()
    const out = duplicateRoutine(src, [src], 'r2')
    expect(out.id).toBe('r2')
    expect(out.name).toBe('Push (kopya)')
    expect(out.ex).toEqual(src.ex)
    expect(out.ex[0]).toMatchObject({ warmups: 2, drops: 1, restSec: 150 })
    expect(out.ex[1]).toMatchObject({ superset: true, side: true })
    expect(out.ex[2]).toMatchObject({ bw: true, weight: -10 })
  })

  it('derin kopyadır: kopyayı değiştirmek kaynağı etkilemez', () => {
    const src = source()
    const out = duplicateRoutine(src, [src], 'r2')
    expect(out.ex).not.toBe(src.ex)
    out.ex[0].sets = 99
    out.ex[1].superset = false
    expect(src.ex[0].sets).toBe(4)
    expect(src.ex[1].superset).toBe(true)
  })

  it('kaynağı değiştirmez ve kaynak adı doluysa sayaç kullanır', () => {
    const src = source()
    const before = JSON.stringify(src)
    const taken: Routine = { id: 'r9', name: 'Push (kopya)', ex: [] }
    const out = duplicateRoutine(src, [src, taken], 'r2')
    expect(out.name).toBe('Push (kopya 2)')
    expect(JSON.stringify(src)).toBe(before)
  })
})
