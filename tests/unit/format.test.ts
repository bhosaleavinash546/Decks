import { describe, expect, it } from 'vitest'
import { clock, percent } from '../../src/ui/format.js'

describe('clock', () => {
  it('formats zero and the ordinary case', () => {
    expect(clock(0)).toBe('0:00.0')
    expect(clock(5.4)).toBe('0:05.4')
    expect(clock(125.34)).toBe('2:05.3')
  })

  it('carries into the next minute instead of printing 60 seconds', () => {
    // Regression: this rendered as "0:60.0" on a real track.
    expect(clock(59.98)).toBe('1:00.0')
    expect(clock(60)).toBe('1:00.0')
    expect(clock(119.99)).toBe('2:00.0')
  })

  it('never prints a seconds field of 60 at any tenth boundary', () => {
    for (let s = 0; s < 600; s += 0.01) {
      const ss = clock(s).split(':')[1]!
      expect(Number(ss)).toBeLessThan(60)
    }
  })

  it('pads the seconds field to two digits', () => {
    expect(clock(9.9)).toBe('0:09.9')
    expect(clock(61.5)).toBe('1:01.5')
  })

  it('clamps negatives rather than printing a minus', () => {
    expect(clock(-3)).toBe('0:00.0')
  })
})

describe('percent', () => {
  it('always shows the sign', () => {
    expect(percent(0)).toBe('+0.00%')
    expect(percent(8)).toBe('+8.00%')
    expect(percent(-8)).toBe('-8.00%')
  })
})
