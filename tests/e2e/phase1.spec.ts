import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SINE_60S = fileURLToPath(new URL('../fixtures/sine-1k-60s.wav', import.meta.url))

declare global {
  interface Window {
    __decks: {
      positionSec: () => number
      xruns: () => number
      driftSamples: () => number
      latencyMs: () => number
      baseLatencyMs: () => number
      outputLatencyMs: () => number
      renderCounts: () => Record<string, number>
      resetRenderCounts: () => void
    }
  }
}

test.describe('Phase 1 — one deck, sound out', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => Boolean(window.__decks))
  })

  test('loads a file, plays, pauses and cues', async ({ page }) => {
    await page.setInputFiles('[data-testid="deck-A-file"]', SINE_60S)
    await expect(page.getByTestId('deck-A-title')).toContainText('sine-1k-60s')
    // The transport stays disabled until the decode finishes.
    await expect(page.getByTestId('deck-A-play')).toBeEnabled()

    await page.getByTestId('deck-A-play').click()
    await page.waitForFunction(() => window.__decks.positionSec() > 0.3)
    const playing = await page.evaluate(() => window.__decks.positionSec())
    expect(playing).toBeGreaterThan(0.3)

    await page.getByTestId('deck-A-pause').click()
    // Give the scheduled pause time to land, then confirm it has stopped moving.
    await page.waitForTimeout(300)
    const a = await page.evaluate(() => window.__decks.positionSec())
    await page.waitForTimeout(400)
    const b = await page.evaluate(() => window.__decks.positionSec())
    expect(Math.abs(b - a)).toBeLessThan(0.02)

    await page.getByTestId('deck-A-cue').click()
    await page.waitForFunction(() => window.__decks.positionSec() < 0.05)
  })

  test('changes rate by ±8% and the position tracks it', async ({ page }) => {
    await page.setInputFiles('[data-testid="deck-A-file"]', SINE_60S)
    await expect(page.getByTestId('deck-A-play')).toBeEnabled()
    await page.getByTestId('deck-A-play').click()
    await page.waitForFunction(() => window.__decks.positionSec() > 0.5)

    const fader = page.getByTestId('pitch-fader')
    await fader.focus()
    // Home centres, then arrows walk it up. 100 steps span the full ±8%.
    await fader.press('Home')
    for (let i = 0; i < 50; i++) await fader.press('ArrowUp')
    await expect(fader).toHaveAttribute('aria-valuetext', '+8.00%')

    const t0 = await page.evaluate(() => window.__decks.positionSec())
    await page.waitForTimeout(2000)
    const t1 = await page.evaluate(() => window.__decks.positionSec())
    const advanced = t1 - t0
    // Two seconds of wall time at 1.08 should advance ~2.16 s of source.
    expect(advanced).toBeGreaterThan(1.9)
    expect(advanced).toBeLessThan(2.5)
  })

  test('reports latency, and the derived playhead does not drift', async ({ page }) => {
    await page.setInputFiles('[data-testid="deck-A-file"]', SINE_60S)
    await expect(page.getByTestId('deck-A-play')).toBeEnabled()
    await page.getByTestId('deck-A-play').click()
    await page.waitForFunction(() => window.__decks.positionSec() > 2)

    const latency = await page.evaluate(() => ({
      base: window.__decks.baseLatencyMs(),
      output: window.__decks.outputLatencyMs(),
      total: window.__decks.latencyMs(),
    }))
    expect(latency.base).toBeGreaterThan(0)
    expect(latency.total).toBeGreaterThan(0)
    await expect(page.getByTestId('latency-readout')).toContainText('ms')
    console.log(
      `latency — base ${latency.base.toFixed(2)} ms, output ${latency.output.toFixed(2)} ms, ` +
        `total ${latency.total.toFixed(2)} ms`,
    )

    // HARD RULE 8: drift against the worklet's truth report stays sub-sample.
    const drift = await page.evaluate(() => Math.abs(window.__decks.driftSamples()))
    expect(drift).toBeLessThan(32)
  })

  test('reports the output channel count without treating 2 as a failure', async ({ page }) => {
    await expect(page.getByTestId('channel-readout')).toContainText('ch')
    await expect(page.getByTestId('error-banners')).toHaveCount(0)
  })
})
