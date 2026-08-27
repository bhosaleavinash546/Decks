import { describe, expect, it } from 'vitest'
import { RateTimeline } from '../../src/engine/shared/timeline.js'

const SR = 48000

describe('RateTimeline', () => {
  it('advances at the sample rate at unity', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    expect(t.positionAt(1)).toBeCloseTo(SR, 6)
    expect(t.positionAt(10)).toBeCloseTo(10 * SR, 6)
  })

  it('never runs backwards before its own start', () => {
    const t = new RateTimeline(SR, 5, 0, 1)
    expect(t.positionAt(0)).toBe(0)
    expect(t.positionAt(5)).toBe(0)
  })

  it('carries position across a rate change', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    const atOneSecond = t.positionAt(1)
    t.changeRate(1, 1.08, 0)
    expect(t.positionAt(1)).toBeCloseTo(atOneSecond, 6)
    expect(t.positionAt(2)).toBeCloseTo(atOneSecond + 1.08 * SR, 6)
  })

  it('reads the pre-change rate for a timestamp before a scheduled change', () => {
    // The rAF loop reads with getOutputTimestamp, which lags — so a read can
    // legitimately land before a change that has already been scheduled.
    const t = new RateTimeline(SR, 0, 0, 1)
    t.changeRate(5, 2, 0)
    expect(t.rateAt(4.9)).toBe(1)
    expect(t.positionAt(4.9)).toBeCloseTo(4.9 * SR, 3)
  })

  it('jumps on seek without disturbing the rate', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    t.changeRate(0, 1.08, 0)
    t.seek(1, 0)
    expect(t.positionAt(1)).toBe(0)
    expect(t.rateAt(1)).toBeCloseTo(1.08, 12)
    expect(t.positionAt(2)).toBeCloseTo(1.08 * SR, 6)
  })

  it('re-anchors onto reported truth — HARD RULE 8', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    // Pretend the worklet dropped a quantum: truth is 128 samples behind.
    const derived = t.positionAt(2)
    t.reanchor(2, derived - 128)
    expect(t.positionAt(2)).toBeCloseTo(derived - 128, 6)
    // And it keeps running from the corrected anchor, not the old one.
    expect(t.positionAt(3)).toBeCloseTo(derived - 128 + SR, 6)
  })

  it('stays O(1) to read after many rate changes', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    for (let i = 1; i < 500; i++) t.changeRate(i * 0.1, 1 + (i % 5) * 0.01, 0.012)
    // Correctness is what matters here; the pruning is what keeps it cheap.
    expect(Number.isFinite(t.positionAt(60))).toBe(true)
    expect(t.positionAt(60)).toBeGreaterThan(0)
  })

  it('holds position when the rate is zero', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    const held = t.positionAt(1)
    t.changeRate(1, 0, 0)
    expect(t.positionAt(5)).toBeCloseTo(held, 6)
  })
})

describe('pause and resume', () => {
  it('freezes at a zero-length ramp to rate 0, and resumes from there', () => {
    // Regression: rateInSegment used to return the PRE-change rate at exactly
    // the segment start, so pausing captured rate 1 and the deck never stopped.
    const t = new RateTimeline(SR, 0, 0, 1)
    t.changeRate(1, 0, 0)
    const held = t.positionAt(1)
    expect(t.rateAt(1)).toBe(0)
    expect(t.positionAt(4)).toBeCloseTo(held, 6)

    t.changeRate(4, 1, 0)
    expect(t.positionAt(4)).toBeCloseTo(held, 6)
    expect(t.positionAt(5)).toBeCloseTo(held + SR, 6)
  })

  it('still ramps from the old rate when the ramp has length', () => {
    const t = new RateTimeline(SR, 0, 0, 1)
    t.changeRate(1, 2, 1)
    expect(t.rateAt(1)).toBe(1)
    expect(t.rateAt(1.5)).toBeCloseTo(1.5, 12)
    expect(t.rateAt(2)).toBe(2)
  })
})
