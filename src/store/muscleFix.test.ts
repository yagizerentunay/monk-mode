import { beforeEach, describe, expect, it } from 'vitest'
import { fingerprint } from '../lib/backupReminder.ts'
import { exportBackup, importBackup } from './backup.ts'
import { migrate } from './migrate.ts'
import { defaultState } from './schema.ts'
import { snapshot, useStore } from './useStore.ts'

beforeEach(() => {
  useStore.getState().replaceAll(defaultState())
})

describe('store: kas düzeltmesi', () => {
  it('düzeltmeyi temizleyip kaydeder', () => {
    useStore.getState().setMuscleFix('Cable_Hip_Adduction', { primary: ['adductors', 'adductors'], secondary: ['adductors', 'glutes'] })
    expect(useStore.getState().muscleFix).toEqual({
      Cable_Hip_Adduction: { primary: ['adductors'], secondary: ['glutes'] },
    })
  })

  it('birincil kas yoksa düzeltmeyi yok sayar', () => {
    useStore.getState().setMuscleFix('x', { primary: [], secondary: ['chest'] })
    expect(useStore.getState().muscleFix).toEqual({})
  })

  it('aynı egzersizde ikinci kayıt öncekinin yerine geçer, başkalarına dokunmaz', () => {
    const s = useStore.getState()
    s.setMuscleFix('a', { primary: ['chest'], secondary: [] })
    s.setMuscleFix('b', { primary: ['lats'], secondary: [] })
    s.setMuscleFix('a', { primary: ['triceps'], secondary: [] })
    expect(useStore.getState().muscleFix).toEqual({
      a: { primary: ['triceps'], secondary: [] },
      b: { primary: ['lats'], secondary: [] },
    })
  })

  it('düzeltmeyi kaldırır; olmayanı kaldırmak hata vermez ve nesneyi değiştirmez', () => {
    const s = useStore.getState()
    s.setMuscleFix('a', { primary: ['chest'], secondary: [] })
    const before = useStore.getState().muscleFix
    s.clearMuscleFix('yok')
    expect(useStore.getState().muscleFix).toBe(before)
    s.clearMuscleFix('a')
    expect(useStore.getState().muscleFix).toEqual({})
  })

  it('snapshot düzeltmeleri içerir', () => {
    useStore.getState().setMuscleFix('a', { primary: ['chest'], secondary: [] })
    expect(snapshot(useStore.getState()).muscleFix).toEqual({ a: { primary: ['chest'], secondary: [] } })
  })
})

describe('migrate ve yedek: kas düzeltmesi', () => {
  it('eski kayıtta (alan yok) boş düzeltmeyle açılır', () => {
    const { muscleFix: _drop, ...old } = defaultState()
    expect(migrate(old).muscleFix).toEqual({})
  })

  it('bozuk kayıtları atar, geçerlileri temizleyerek tutar', () => {
    const out = migrate({
      ...defaultState(),
      muscleFix: {
        ok: { primary: ['chest', 'foo'], secondary: ['chest', 'triceps'] },
        bosBirincil: { primary: [], secondary: ['chest'] },
        metin: 'chest',
        dizi: ['chest'],
        sayi: 3,
      },
    })
    expect(out.muscleFix).toEqual({ ok: { primary: ['chest'], secondary: ['triceps'] } })
  })

  it('muscleFix dizi ya da metin ise boş sayılır', () => {
    expect(migrate({ ...defaultState(), muscleFix: [1, 2] }).muscleFix).toEqual({})
    expect(migrate({ ...defaultState(), muscleFix: 'x' }).muscleFix).toEqual({})
  })

  it('__proto__ anahtarı prototipi bozmaz', () => {
    const raw = JSON.parse('{"__proto__": {"primary": ["chest"], "secondary": []}}')
    const out = migrate({ ...defaultState(), muscleFix: raw })
    expect(Object.getPrototypeOf(out.muscleFix)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).primary).toBeUndefined()
  })

  it('yedek dışa/içe aktarmada düzeltmeler korunur', () => {
    useStore.getState().setMuscleFix('Cable_Hip_Adduction', { primary: ['adductors'], secondary: [] })
    const text = exportBackup(snapshot(useStore.getState()))
    expect(importBackup(text).muscleFix).toEqual({ Cable_Hip_Adduction: { primary: ['adductors'], secondary: [] } })
  })
})

describe('yedek parmak izi: kas düzeltmesi', () => {
  it('düzeltmesi olmayan verinin izi, alan hiç yokmuş gibi aynıdır (güncellemede yanlış hatırlatma çıkmaz)', () => {
    const s = defaultState()
    const { muscleFix: _drop, ...withoutField } = s
    expect(fingerprint(s)).toBe(fingerprint(withoutField))
  })

  it('düzeltme eklenince ya da değişince iz değişir', () => {
    const s = defaultState()
    const a = fingerprint({ ...s, muscleFix: { x: { primary: ['chest'], secondary: [] } } })
    const b = fingerprint({ ...s, muscleFix: { x: { primary: ['lats'], secondary: [] } } })
    expect(a).not.toBe(fingerprint(s))
    expect(a).not.toBe(b)
  })
})
