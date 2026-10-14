import { expect, test, type Page } from '@playwright/test'
import { defaultState, type State } from '../src/store/schema.ts'
import { BENCH, seed } from './seed.ts'

function richState(): State {
  const s = defaultState()
  const d = new Date().toLocaleDateString('sv-SE')
  s.routines = [
    {
      id: 'r1',
      name: 'Erişilebilirlik',
      ex: [
        { exId: BENCH, sets: 2, reps: 5, weight: 60, prog: 'double', inc: 2.5, repsMax: 8, warmups: 1, drops: 1 },
        { exId: 'Dumbbell_Bicep_Curl', sets: 2, reps: 10, weight: 12, prog: 'off', inc: 1, repsMax: 12, side: true, superset: true },
        { exId: 'Pullups', sets: 2, reps: 6, weight: 0, prog: 'off', inc: 0, repsMax: 6, bw: true },
      ],
    },
  ]
  s.week = { [new Date().getDay()]: 'r1' }
  s.bodyweight = [{ d, w: 80 }]
  s.workouts = [
    {
      id: 'w1',
      d,
      start: Date.now() - 7_200_000,
      end: Date.now() - 3_600_000,
      routineId: 'r1',
      name: 'Erişilebilirlik',
      entries: [{ exId: BENCH, sets: [{ w: 60, r: 5, done: true, rir: 2 }] }],
    },
  ]
  return s
}

/** Erişilebilir adı olmayan etkileşimli öğeleri ve alt'sız görselleri listeler. */
async function audit(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = []
    const nameOf = (el: Element): string => {
      const aria = el.getAttribute('aria-label')?.trim()
      if (aria) return aria
      const labelledby = el.getAttribute('aria-labelledby')
      if (labelledby) {
        const t = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        if (t) return t
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        const labels = el.labels ? [...el.labels].map((l) => l.textContent ?? '').join(' ').trim() : ''
        if (labels) return labels
        if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder
      }
      return (el.textContent ?? '').trim() || el.getAttribute('title')?.trim() || ''
    }
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const st = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
    }
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className || '-'}`
    for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, [role=button], [role=tab]')) {
      if (!visible(el)) continue
      if (!nameOf(el)) problems.push(`adsız etkileşimli öğe: ${describe(el)}`)
    }
    for (const img of document.querySelectorAll('img')) {
      if (!visible(img)) continue
      if (!img.hasAttribute('alt')) problems.push(`alt yok: ${img.getAttribute('src')}`)
    }
    // Dokunma hedefi: görünür düğme ve bağlantılar en az 32 px (44 hedeflenir; 32 altı gerçek sorun).
    for (const el of document.querySelectorAll('button, a[href]')) {
      if (!visible(el)) continue
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.height < 28 && r.width < 28) problems.push(`çok küçük dokunma hedefi: ${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    if (!document.documentElement.lang) problems.push('html lang yok')
    if (document.querySelectorAll('h1').length === 0) problems.push('h1 yok')
    return problems
  })
}

for (const [name, route] of [
  ['Ana sayfa', '#/'],
  ['Plan', '#/plan'],
  ['Rutin düzenleyici', '#/plan/r/r1'],
  ['Analiz', '#/stats'],
  ['Kütüphane', '#/library'],
  ['Ayarlar', '#/settings'],
] as const) {
  test(`erişilebilirlik: ${name} adsız öğe, alt'sız görsel ve küçük hedef içermez`, async ({ page }) => {
    await seed(page, JSON.stringify(richState()))
    await page.goto(`./${route}`)
    await page.locator('main.app').filter({ hasText: /./ }).first().waitFor()
    await page.waitForLoadState('networkidle')
    expect(await audit(page)).toEqual([])
  })
}

test('erişilebilirlik: antrenman ekranı ve özet', async ({ page }) => {
  await seed(page, JSON.stringify(richState()))
  page.on('dialog', (d) => void d.accept())
  await page.goto('./#/workout')
  await page.getByRole('button', { name: /Erişilebilirlik/ }).first().click()
  // İlk 'Seti tamamla' ısınma setidir; çalışma setini adıyla seç (yalnız ısınma yapılan antrenman kaydedilmez).
  await page
    .locator('.set')
    .filter({ has: page.getByRole('textbox', { name: 'Set 1 ağırlık', exact: true }) })
    .first()
    .getByRole('button', { name: 'Seti tamamla' })
    .click()
  await page.waitForLoadState('networkidle')
  expect(await audit(page)).toEqual([])
  await page.getByRole('button', { name: 'Bitir ✓' }).click()
  await expect(page.getByText('Antrenman bitti')).toBeVisible()
  expect(await audit(page)).toEqual([])
})
