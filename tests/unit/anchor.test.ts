// Regression tests for the two anchor bugs the option 4 spike hit.
//
// Both were found by measurement rather than reasoning, twice, and both read as
// "the playhead is slightly wrong and never recovers". They get tests because
// the real deck will find them a third time.

import { describe, expect, it } from 'vitest'
import { RateTimeline } from '../../src/engine/shared/timeline.js'
import { QUANTUM, WorkletSim } from './workletSim.js'

const SR = 48000
/** Deliberately not a multiple of 128, so the two anchors cannot coincide. */
const START_FRAME = 1000

function run(sim: WorkletSim, quanta: number): void {
  const first = Math.floor(START_FRAME / QUANTUM) * QUANTUM
  for (let q = 0; q < quanta; q++) sim.render(first + q * QUANTUM)
}

describe('anchor bug 1 — starting on the quantum boundary', () => {
  it('is exact when playback begins on the scheduled sample', () => {
    const sim = new WorkletSim({ startFrame: START_FRAME }, SR)
    run(sim, 400)
    const timeline = new RateTimeline(SR, START_FRAME / SR, 0, 1)
    const endFrame = Math.floor(START_FRAME / QUANTUM) * QUANTUM + 400 * QUANTUM
    expect(Math.abs(timeline.positionAt(endFrame / SR) - sim.playhead)).toBeLessThan(1e-6)
  })

  it('runs permanently early when it begins on the quantum boundary instead', () => {
    const sim = new WorkletSim({ startFrame: START_FRAME, startOnQuantumBoundary: true }, SR)
    run(sim, 400)
    const timeline = new RateTimeline(SR, START_FRAME / SR, 0, 1)
    const endFrame = Math.floor(START_FRAME / QUANTUM) * QUANTUM + 400 * QUANTUM
    const error = sim.playhead - timeline.positionAt(endFrame / SR)
    // START_FRAME 1000 sits 104 samples into the quantum beginning at 896.
    expect(error).toBeCloseTo(START_FRAME - Math.floor(START_FRAME / QUANTUM) * QUANTUM, 6)
    // And it does not heal: the offset is the same much later.
    run(sim, 4000)
    const laterFrame = endFrame + 4000 * QUANTUM
    expect(sim.playhead - timeline.positionAt(laterFrame / SR)).toBeCloseTo(error, 6)
  })
})

describe('anchor bug 2 — reporting a playhead against a stale timestamp', () => {
  const quanta = 200

  it('agrees with the derived position when reported before advancing', () => {
    const sim = new WorkletSim({ startFrame: 0 }, SR)
    const timeline = new RateTimeline(SR, 0, 0, 1)
    for (let q = 0; q < quanta; q++) sim.render(q * QUANTUM, q % 50 === 0)
    for (const r of sim.reports) {
      expect(Math.abs(timeline.positionAt(r.contextTime) - r.playhead)).toBeLessThan(1e-6)
    }
  })

  it('is off by exactly one quantum when reported after advancing', () => {
    const sim = new WorkletSim({ startFrame: 0, reportAfterAdvancing: true }, SR)
    const timeline = new RateTimeline(SR, 0, 0, 1)
    for (let q = 0; q < quanta; q++) sim.render(q * QUANTUM, q % 50 === 0)
    for (const r of sim.reports) {
      const drift = r.playhead - timeline.positionAt(r.contextTime)
      expect(drift).toBeCloseTo(QUANTUM, 6)
    }
  })

  it('scales the stale-timestamp error with the playback rate', () => {
    // At 1.08 the error is 128 × 1.08, which is why the raw number looked like
    // "about 138 samples" in the spike rather than a clean quantum.
    const sim = new WorkletSim({ startFrame: 0, reportAfterAdvancing: true }, SR)
    sim.rampTo(1.08, 1)
    const timeline = new RateTimeline(SR, 0, 0, 1)
    timeline.changeRate(0, 1.08, 1 / SR)
    for (let q = 0; q < 100; q++) sim.render(q * QUANTUM, q === 99)
    const r = sim.reports[0]!
    expect(r.playhead - timeline.positionAt(r.contextTime)).toBeCloseTo(QUANTUM * 1.08, 3)
  })

  it('crosses the deck re-anchor threshold, so the bug would be self-inflicted', () => {
    // FileDeck re-anchors above 32 samples. A stale-timestamp report is ~128,
    // so the bug would trigger a correction every second — visible as a jump.
    expect(QUANTUM).toBeGreaterThan(32)
  })
})
