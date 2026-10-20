import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { defaultState, type State } from '../src/store/schema.ts'

export const STORAGE_KEY = 'monk_state_v1'
export const BENCH = 'Barbell_Bench_Press_-_Medium_Grip'

/** Kütüphanedeki egzersiz sayısı (public/data/exercises.json); Atlas eşitlemesi sayıyı değiştirince testler kırılmasın diye dosyadan okunur. */
export const CATALOG_SIZE: number = (JSON.parse(readFileSync(new URL('../public/data/exercises.json', import.meta.url), 'utf8')) as unknown[]).length

/** Tek egzersizli (2 set bench press) bir rutini olan örnek state. */
export function stateWithRoutine(): State {
  return {
    ...defaultState(),
    routines: [
      {
        id: 'r-push',
        name: 'E2E Push',
        ex: [{ exId: BENCH, sets: 2, reps: 5, weight: 60, prog: 'off', inc: 2.5, repsMax: 8 }],
      },
    ],
  }
}

/** Uygulamayı açar, localStorage'a ham değeri yazar ve yeniden yükler (uygulama açılışta okur). */
export async function seed(page: Page, raw: string): Promise<void> {
  await page.goto('./')
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, raw] as const)
  await page.reload()
}

/**
 * Kayıtlı state'i okur. Uygulama kaydı kısar (src/store/saveScheduler.ts); okumadan önce sayfa kapanıyormuş
 * gibi `pagehide` gönderilir, uygulama bekleyen kaydı yazar (gerçek telefondaki kapanış yolu).
 */
export async function readState(page: Page): Promise<State> {
  return page.evaluate((key) => {
    window.dispatchEvent(new Event('pagehide'))
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  }, STORAGE_KEY)
}
