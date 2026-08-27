import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SINE = fileURLToPath(new URL('../fixtures/sine-1k-60s.wav', import.meta.url))
const BROKEN = fileURLToPath(new URL('../fixtures/broken.wav', import.meta.url))

// HARD RULE: the music never stops (§5.6). Any error, any failed load, any
// exception — the currently playing deck keeps playing, and the failure surfaces
// as a banner, never a modal, never a blocked UI.
test('a failed load during playback does not interrupt the audio', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })

  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).__decks))
  await page.setInputFiles('[data-testid="deck-A-file"]', SINE)
  await expect(page.getByTestId('deck-A-play')).toBeEnabled()
  await page.getByTestId('deck-A-play').click()
  await page.waitForFunction(() => (window as any).__decks.positionSec() > 1)

  const before = await page.evaluate(() => (window as any).__decks.positionSec())

  // A real failure path, not a synthetic one: decodeAudioData rejects this.
  await page.setInputFiles('[data-testid="deck-A-file"]', BROKEN)
  await expect(page.getByTestId('error-banner').first()).toBeVisible()

  // The banner must not be modal, and must not cover the transport.
  expect(dialogs).toEqual([])
  await expect(page.getByTestId('deck-A-play')).toBeEnabled()

  // And the audio kept going straight through it.
  await page.waitForTimeout(1500)
  const after = await page.evaluate(() => (window as any).__decks.positionSec())
  expect(after).toBeGreaterThan(before + 1.0)

  // Still playing a second later, not limping.
  const later = await page.evaluate(() => (window as any).__decks.positionSec())
  expect(later).toBeGreaterThanOrEqual(after)

  // The banner is dismissible — never a blocked UI.
  await page.getByRole('button', { name: 'Dismiss' }).first().click()
  await expect(page.getByTestId('error-banner')).toHaveCount(0)
})
