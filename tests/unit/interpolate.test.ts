import { describe, expect, it } from 'vitest'
import { hermite4 } from '../../src/engine/dsp/interpolate.js'

describe('hermite4', () => {
  it('returns silence for silence', () => {
    for (let f = 0; f <= 1; f += 0.1) expect(hermite4(0, 0, 0, 0, f)).toBe(0)
  })

  it('passes through the control points at the ends', () => {
    expect(hermite4(-1, 0.25, 0.75, 1, 0)).toBeCloseTo(0.25, 12)
    expect(hermite4(-1, 0.25, 0.75, 1, 1)).toBeCloseTo(0.75, 12)
  })

  it('reproduces a straight line exactly', () => {
    // A cubic through four collinear points must be that line.
    const line = (x: number) => 3 * x + 1
    for (let f = 0; f <= 1; f += 0.125) {
      expect(hermite4(line(-1), line(0), line(1), line(2), f)).toBeCloseTo(line(f), 10)
    }
  })

  it('tracks a sine far more closely than linear interpolation does', () => {
    const w = 2 * Math.PI * 0.05 // a fast tone relative to the sample rate
    const at = (i: number) => Math.sin(w * i)
    let hermiteErr = 0
    let linearErr = 0
    for (let i = 4; i < 200; i++) {
      for (const f of [0.25, 0.5, 0.75]) {
        const truth = Math.sin(w * (i + f))
        hermiteErr += Math.abs(hermite4(at(i - 1), at(i), at(i + 1), at(i + 2), f) - truth)
        linearErr += Math.abs(at(i) + (at(i + 1) - at(i)) * f - truth)
      }
    }
    expect(hermiteErr).toBeLessThan(linearErr / 10)
  })

  it('does not overshoot a monotonic ramp', () => {
    for (let f = 0; f <= 1; f += 0.05) {
      const v = hermite4(0, 0.25, 0.5, 0.75, f)
      expect(v).toBeGreaterThanOrEqual(0.25 - 1e-12)
      expect(v).toBeLessThanOrEqual(0.5 + 1e-12)
    }
  })
})
