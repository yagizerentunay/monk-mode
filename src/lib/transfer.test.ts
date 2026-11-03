import { describe, expect, it } from 'vitest'
import { exportBackup } from '../store/backup.ts'
import { defaultState, type State, type Workout } from '../store/schema.ts'
import { mergeState } from './mergeBackup.ts'
import { previewTransfer, transferPlatform } from './transfer.ts'

const wk = (id: string, d: string, start: number, w = 60): Workout => ({
  id,
  d,
  start,
  end: start + 3_600_000,
  name: 'Push',
  entries: [{ exId: 'bench', sets: [{ w, r: 5, done: true }] }],
})

const stateWith = (workouts: Workout[]): State => ({ ...defaultState(), workouts })

describe('transferPlatform', () => {
  it('iPhone ve iPad AirDrop, Android Quick Share yoluna gider', () => {
    expect(transferPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
    expect(transferPlatform('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)')).toBe('ios')
    expect(transferPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36')).toBe('android')
  })

  it('masaüstü ve bilinmeyen tarayıcı genel talimatı alır', () => {
    expect(transferPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0')).toBe('other')
    expect(transferPlatform('')).toBe('other')
  })
})

describe('previewTransfer', () => {
  const local = stateWith([wk('w1', '2026-03-02', 1000), wk('w2', '2026-03-03', 2000)])
  const other = stateWith([wk('w1', '2026-03-02', 1000), wk('w2', '2026-03-03', 2000, 99), wk('w3', '2026-03-01', 500)])

  it('ne ekleneceğini, neyin zaten olduğunu ve neyin çakıştığını yazmadan hesaplar', () => {
    const p = previewTransfer(exportBackup(other), local)
    expect(p.hasNew).toBe(true)
    expect(p.report.workouts).toEqual({ added: 1, identical: 1, conflicting: 1 })
    expect(p.summary).toBe('1 antrenman eklendi; 1 kayıt zaten vardı; 1 kayıt farklı, yereldeki korundu.')
    // Yerel veri değişmedi.
    expect(local.workouts.map((w) => w.id)).toEqual(['w1', 'w2'])
  })

  it('önizleme gerçek birleştirmeyle aynı sonucu verir', () => {
    const p = previewTransfer(exportBackup(other), local)
    expect(p.report).toEqual(mergeState(local, p.incoming).report)
  })

  it('girintisiz (aktarım) dosyası da okunur ve aynı önizlemeyi verir', () => {
    const compact = exportBackup(other, new Date(), { compact: true })
    expect(compact).not.toContain('\n')
    expect(previewTransfer(compact, local).report).toEqual(previewTransfer(exportBackup(other), local).report)
  })

  it('yeni kayıt yoksa hasNew false', () => {
    const p = previewTransfer(exportBackup(local), local)
    expect(p.hasNew).toBe(false)
    expect(p.summary).toBe('yeni kayıt yok; 2 kayıt zaten vardı.')
  })

  it('geçersiz dosyada anlaşılır hata fırlatır', () => {
    expect(() => previewTransfer('{"a":1}', local)).toThrow('Bu dosya bir monk-mode yedeği değil.')
    expect(() => previewTransfer('yedek değil', local)).toThrow('Dosya geçerli bir JSON değil.')
  })
})
