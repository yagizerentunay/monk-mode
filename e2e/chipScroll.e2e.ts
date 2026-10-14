import { expect, test } from '@playwright/test'

// Masaüstü: fare, dokunma yok. Dar pencere (~513px) çip satırını taşırır.
test.use({ viewport: { width: 513, height: 800 }, isMobile: false, hasTouch: false })

test('kütüphane: dikey fare tekerleği çip satırını yatay kaydırır, son çipe ulaşılır', async ({ page }) => {
  await page.goto('./#/library')
  const row = page.locator('.exbrowser .chips').first()
  const chips = row.locator('.chip')
  await expect(chips.nth(5)).toBeVisible()

  const metrics = () => row.evaluate((el) => ({ left: el.scrollLeft, max: el.scrollWidth - el.clientWidth }))
  expect((await metrics()).max).toBeGreaterThan(50)

  const last = chips.last()
  const inView = () =>
    last.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const parent = (el.parentElement as HTMLElement).getBoundingClientRect()
      return box.left >= parent.left && box.right <= parent.right + 1
    })
  expect(await inView()).toBe(false)

  const box = (await row.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 300)
  await expect.poll(async () => (await metrics()).left).toBeGreaterThan(0)

  // Sona kadar kaydır: son çip görünür olur.
  for (let i = 0; i < 20 && !(await inView()); i++) await page.mouse.wheel(0, 400)
  await expect.poll(inView).toBe(true)

  // Sonda tekerlek tutulmaz: sayfa kendi dikey kaydırmasına geri döner (yatay konum sabit kalır).
  const before = (await metrics()).left
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(100)
  expect((await metrics()).left).toBe(before)

  // Geri yönde de kayar (sayfa kaydığı için fareyi satırın üzerine geri getir).
  await row.scrollIntoViewIfNeeded()
  const box2 = (await row.boundingBox())!
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => (await metrics()).left).toBeLessThan(before)
})

test('kütüphane: klavye odağı gizli çipi görünür alana getirir', async ({ page }) => {
  await page.goto('./#/library')
  const row = page.locator('.exbrowser .chips').first()
  const last = row.locator('.chip').last()
  await expect(last).toBeVisible()
  await last.focus()
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await expect(last).toBeInViewport({ ratio: 0.99 })
})
