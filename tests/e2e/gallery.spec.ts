import { expect, test } from '@playwright/test'

test('/dev/gallery renders every control with no AudioContext constructed', async ({ page }) => {
  // Trap the constructor before any app code runs.
  await page.addInitScript(() => {
    ;(window as any).__audioContextsCreated = 0
    for (const name of ['AudioContext', 'webkitAudioContext'] as const) {
      const Original = (window as any)[name]
      if (!Original) continue
      ;(window as any)[name] = class extends Original {
        constructor(...args: unknown[]) {
          ;(window as any).__audioContextsCreated++
          super(...(args as []))
        }
      }
    }
  })

  await page.goto('/dev/gallery')
  await expect(page.getByRole('heading', { name: 'Gallery' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'Pitch' })).toBeVisible()

  // Design there, not in the running app (§17.5).
  expect(await page.evaluate(() => (window as any).__audioContextsCreated)).toBe(0)
})

test('a disabled control explains itself rather than hiding', async ({ page }) => {
  await page.goto('/dev/gallery')
  const disabled = page.getByRole('button', { name: 'Disabled' })
  await expect(disabled).toBeVisible()
  await expect(disabled).toBeDisabled()
  await expect(disabled).toHaveAttribute('title', /audio isn't available to the mixer/)
})
