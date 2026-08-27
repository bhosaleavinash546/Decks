import { describe, expect, it } from 'vitest'
import { positionInSegment, rateInSegment, type RateSegment } from '../../src/engine/shared/ramp.js'
import { RateFollower } from '../../src/engine/shared/rateFollower.js'

const SR = 48000

/** Walk the follower sample by sample, exactly as the worklet's loop does. */
function walk(from: number, to: number, rampFrames: number, totalFrames: number): number {
  const f = new RateFollower(from)
  f.rampTo(to, rampFrames)
  let pos = 0
  for (let i = 0; i < totalFrames; i++) pos += f.step()
  return pos
}

describe('the rate curve — HARD RULE 9', () => {
  it('agrees between the closed form and the per-sample walk', () => {
    const rampFrames = 576 // 12 ms at 48 kHz
    const totalFrames = SR * 5
    const seg: RateSegment = {
      startTime: 0,
      startPosition: 0,
      from: 1,
      to: 1.08,
      rampSec: rampFrames / SR,
    }
    const closedForm = positionInSegment(seg, totalFrames / SR, SR)
    const perSample = walk(1, 1.08, rampFrames, totalFrames)
    // Both describe the same trapezoid. The residual is float64 accumulation
    // from summing 240 000 additions, not a curve mismatch — it grows with the
    // walk length, so the bound is stated in samples rather than ulps. Anything
    // approaching a whole sample means the two sides have genuinely diverged.
    expect(Math.abs(closedForm - perSample)).toBeLessThan(1e-3)
  })

  it('stays exact across many same-direction ramps', () => {
    // The failure mode a symmetric test hides: a sync engine nudging one way
    // repeatedly accumulates any per-ramp error instead of cancelling it.
    const rampFrames = 480
    const between = SR
    const f = new RateFollower(1)
    let perSample = 0
    let closedForm = 0
    let rate = 1
    let t = 0
    for (let n = 0; n < 30; n++) {
      const to = rate + 0.002
      f.rampTo(to, rampFrames)
      for (let i = 0; i < between; i++) perSample += f.step()
      closedForm += positionInSegment(
        { startTime: t, startPosition: 0, from: rate, to, rampSec: rampFrames / SR },
        t + between / SR,
        SR,
      )
      rate = to
      t += between / SR
    }
    expect(Math.abs(closedForm - perSample)).toBeLessThan(0.05)
  })

  it('is a midpoint sum, not a left or right Riemann sum', () => {
    // A left sum undershoots and a right sum overshoots by half a step per ramp.
    // Pinning this stops a "simplification" that reintroduces the error.
    const rampFrames = 100
    const from = 1
    const to = 2
    const walked = walk(from, to, rampFrames, rampFrames)
    const trapezoid = rampFrames * ((from + to) / 2)
    const leftSum = rampFrames * from + ((to - from) * (rampFrames - 1)) / 2
    expect(Math.abs(walked - trapezoid)).toBeLessThan(1e-9)
    expect(Math.abs(leftSum - trapezoid)).toBeGreaterThan(0.4)
  })

  it('holds the target rate once the ramp completes', () => {
    const f = new RateFollower(1)
    f.rampTo(1.08, 10)
    for (let i = 0; i < 10; i++) f.step()
    expect(f.ramping).toBe(false)
    expect(f.rate).toBeCloseTo(1.08, 12)
  })

  it('reports the instantaneous rate mid-ramp', () => {
    const seg: RateSegment = { startTime: 0, startPosition: 0, from: 1, to: 2, rampSec: 1 }
    expect(rateInSegment(seg, -1)).toBe(1)
    expect(rateInSegment(seg, 0.5)).toBeCloseTo(1.5, 12)
    expect(rateInSegment(seg, 5)).toBe(2)
  })

  it('treats a zero-length ramp as an instant change', () => {
    const seg: RateSegment = { startTime: 0, startPosition: 0, from: 1, to: 0, rampSec: 0 }
    expect(positionInSegment(seg, 10, SR)).toBe(0)
  })
})
