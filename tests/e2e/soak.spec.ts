import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SINE = fileURLToPath(new URL('../fixtures/sine-1k-60s.wav', import.meta.url))
const MINUTES = Number(process.env.SOAK_MINUTES ?? 10)

// Phase 1 gate: ten minutes of playback with zero xruns. The fixture is 60 s,
// so the test cues back near the end — which also exercises repeated scheduled
// seeks rather than letting one long buffer coast.
test('ten minutes of continuous playback with zero xruns', async ({ page }) => {
  test.setTimeout((MINUTES + 5) * 60 * 1000)

  await page.goto('/')
  await page.waitForFunction(() => Boolean((window as any).__decks))
  await page.setInputFiles('[data-testid="deck-A-file"]', SINE)
  await expect(page.getByTestId('deck-A-play')).toBeEnabled()
  await page.getByTestId('deck-A-play').click()
  await page.waitForFunction(() => (window as any).__decks.positionSec() > 0.5)

  const deadline = Date.now() + MINUTES * 60 * 1000
  let lastPos = 0
  let stalls = 0

  while (Date.now() < deadline) {
    await page.waitForTimeout(5000)
    const pos = await page.evaluate(() => (window as any).__decks.positionSec())
    if (pos <= lastPos && pos > 1) stalls++
    lastPos = pos
    if (pos > 55) {
      await page.getByTestId('deck-A-cue').click()
      await page.waitForTimeout(200)
      lastPos = 0
    }
  }

  const { xruns, drift } = await page.evaluate(() => ({
    xruns: (window as any).__decks.xruns(),
    drift: Math.abs((window as any).__decks.driftSamples()),
  }))

  console.log(`soak — ${MINUTES} min, xruns ${xruns}, final drift ${drift.toFixed(2)} samples, stalls ${stalls}`)
  expect(stalls).toBe(0)
  expect(drift).toBeLessThan(32)
  expect(xruns).toBe(0)
})
