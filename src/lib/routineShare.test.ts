import { describe, expect, it } from 'vitest'
import type { CustomExercise, Routine } from '../store/schema.ts'
import { decodeRoutine, encodeRoutine, MAX_PAYLOAD_CHARS, shareUrl, ShareError } from './routineShare.ts'

const routine: Routine = {
  id: 'r-push',
  name: 'Push · Göğüs',
  ex: [
    { exId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 4, reps: 6, repsMax: 10, weight: 62.5, prog: 'double', inc: 2.5, warmups: 2, restSec: 150 },
    { exId: 'Dips', sets: 3, reps: 8, repsMax: 12, weight: -10, prog: 'linear', inc: 1, bw: true, superset: true, drops: 1 },
    { exId: 'Plank', sets: 3, reps: 45, repsMax: 60, weight: 0, prog: 'off', inc: 0, timed: true, side: true },
    { exId: 'c-mine', sets: 2, reps: 10, repsMax: 10, weight: 5, prog: 'double', inc: 2.5 },
  ],
}
const custom: CustomExercise[] = [
  { id: 'c-mine', name: 'Benim hareketim', primaryMuscles: ['chest'], equipment: 'cable' },
  { id: 'c-unused', name: 'Kullanılmayan', primaryMuscles: [], equipment: '' },
]

/** Ham JSON'u (paylaşım biçimini atlayarak) payload'a çevirir: bozuk/kötü niyetli link örnekleri için. */
async function pack(json: string): Promise<string> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const rejects = (text: string) => expect(decodeRoutine(text)).rejects.toBeInstanceOf(ShareError)

describe('rutin paylaşımı', () => {
  it('gidiş-dönüş: her alan korunur, kimlik boşalır, yalnız kullanılan özel egzersiz gider', async () => {
    const payload = await encodeRoutine(routine, custom)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
    const { routine: back, customEx } = await decodeRoutine(payload)
    expect(back).toEqual({ ...routine, id: '' })
    expect(customEx).toEqual([custom[0]])
  })

  it('mesafe egzersizi hedef süre ve mesafesiyle gidip döner', async () => {
    const cardio: Routine = {
      id: 'r-cardio',
      name: 'Kardiyo',
      ex: [{ exId: 'Treadmill', sets: 1, reps: 1800, repsMax: 1800, weight: 0, prog: 'off', inc: 0, distance: true, meters: 5000, restSec: 120 }],
    }
    const { routine: back } = await decodeRoutine(await encodeRoutine(cardio, []))
    expect(back).toEqual({ ...cardio, id: '' })
  })

  it('link kısa: 4 egzersizlik rutin 300 karakterin altında', async () => {
    expect((await encodeRoutine(routine, custom)).length).toBeLessThan(300)
  })

  it('link adresi uygulamanın yoluna eklenir', () => {
    expect(shareUrl('abc', { origin: 'https://x.github.io', pathname: '/monk-mode/' })).toBe('https://x.github.io/monk-mode/#/share/abc')
  })

  it('bozuk veriyi reddeder', async () => {
    await rejects('')
    await rejects('!!!not-base64!!!')
    await rejects('AAAA')
    const good = await encodeRoutine(routine)
    await rejects(good.slice(0, good.length - 10))
    await rejects(await pack('not json'))
    await rejects(await pack('[1,2,3]'))
    await rejects(await pack('{"n":"x","e":[["a",3,8,12,0,2,2.5]]}'))
    await rejects(await pack('{"v":1,"n":"x","e":"nope"}'))
    await rejects(await pack('{"v":1,"n":"x","e":[[5],[null]]}'))
  })

  it('daha yeni sürümün linkini güncelleme mesajıyla reddeder', async () => {
    await expect(decodeRoutine(await pack('{"v":2,"n":"x","e":[]}'))).rejects.toThrow(/güncelle/)
  })

  it('aşırı sayıları kırpar, geçersiz egzersizleri atar', async () => {
    const { routine: r } = await decodeRoutine(
      await pack('{"v":1,"n":"x","e":[["a",1e9,1e9,1e9,1e9,9,1e9,0,99,99,1e9],[42],["b",3,8,12,0,1,2.5,8,0,0,0]]}'),
    )
    expect(r.ex).toHaveLength(2)
    expect(r.ex[0]).toMatchObject({ exId: 'a', sets: 20, reps: 1000, repsMax: 1000, weight: 0, prog: 'double', inc: 100, warmups: 4, drops: 3, restSec: 3600 })
    expect(r.ex[1]).toMatchObject({ exId: 'b', prog: 'linear', timed: true })
  })

  it('boyut sınırı: çok büyük link ve sıkıştırma bombası reddedilir', async () => {
    await expect(decodeRoutine('A'.repeat(MAX_PAYLOAD_CHARS + 1))).rejects.toThrow(/çok büyük/)
    // ~1 MB boşluk birkaç yüz bayta sıkışır; açma 64 KB'ta kesilmeli.
    const bomb = await pack(`{"v":1,"n":"x"${' '.repeat(1_000_000)},"e":[["a",3,8,12,0,2,2.5]]}`)
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD_CHARS)
    await expect(decodeRoutine(bomb)).rejects.toThrow(/çok büyük/)
  })

  it('paylaşılamayacak kadar büyük rutinde net hata verir', async () => {
    const many: Routine = {
      id: 'big',
      name: 'Dev',
      ex: Array.from({ length: 61 }, (_, i) => ({ exId: `ex-${i}`, sets: 3, reps: 8, repsMax: 12, weight: 0, prog: 'double' as const, inc: 2.5 })),
    }
    await expect(encodeRoutine(many)).rejects.toThrow(/çok büyük/)
    // Rastgele kimlikler sıkışmaz: 60 egzersiz sınırın altında kalsa da link sınırı aşılır.
    const random: Routine = {
      ...many,
      ex: many.ex.slice(0, 60).map((e) => ({ ...e, exId: Array.from({ length: 100 }, () => Math.random().toString(36)[2]).join('') })),
    }
    await expect(encodeRoutine(random)).rejects.toThrow(/çok büyük/)
  })
})
