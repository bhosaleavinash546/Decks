import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SINE = fileURLToPath(new URL('../fixtures/sine-1k-60s.wav', import.meta.url))

// §17.3: React must not re-render on playhead updates. Numeric readouts are
// written via refs to textContent; a render during playback is a defect.
test('zero React renders during 60 seconds of playback', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000)

  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).__decks))
  await page.setInputFiles('[data-testid="deck-A-file"]', SINE)
  await expect(page.getByTestId('deck-A-play')).toBeEnabled()
  await page.getByTestId('deck-A-play').click()
  await page.waitForFunction(() => (window as any).__decks.positionSec() > 1)

  // Reset only once playback is established, so mount renders do not count.
  await page.evaluate(() => (window as any).__decks.resetRenderCounts())

  const startPos = await page.evaluate(() => (window as any).__decks.positionSec())
  await page.waitForTimeout(60_000)
  const endPos = await page.evaluate(() => (window as any).__decks.positionSec())

  // It really did play for the whole minute.
  expect(endPos - startPos).toBeGreaterThan(55)

  const counts = await page.evaluate(() => (window as any).__decks.renderCounts())
  expect(counts.DeckPanel ?? 0).toBe(0)

  // And the readout was still being updated the whole time, via refs.
  const elapsed = await page.getByTestId('deck-A').locator('.numeric').first().textContent()
  expect(elapsed).toMatch(/\d+:\d\d\.\d/)
})
