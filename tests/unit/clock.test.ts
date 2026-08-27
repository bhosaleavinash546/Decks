import { describe, expect, it, vi } from 'vitest'
import { audibleNow, renderNow } from '../../src/engine/clock.js'

function fakeCtx(currentTime: number, timestamp?: { contextTime: number; performanceTime: number }) {
  return {
    currentTime,
    getOutputTimestamp: timestamp ? () => timestamp : undefined,
  } as unknown as AudioContext
}

describe('audibleNow', () => {
  it('interpolates the output timestamp against performance.now', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1200)
    // The frame being heard was at context time 3.0 when performance.now was
    // 1000; 200 ms of wall time have passed since.
    const t = audibleNow(fakeCtx(3.5, { contextTime: 3.0, performanceTime: 1000 }))
    expect(t).toBeCloseTo(3.2, 6)
    vi.restoreAllMocks()
  })

  it('reports behind the render clock, which is the whole point', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const ctx = fakeCtx(3.5, { contextTime: 3.0, performanceTime: 1000 })
    // ctx.currentTime describes the frame just rendered; the spike measured the
    // gap at 35.8 ms, and showing it would put the playhead ahead of the sound.
    expect(audibleNow(ctx)).toBeLessThan(renderNow(ctx))
    vi.restoreAllMocks()
  })

  it('falls back to currentTime when getOutputTimestamp is absent', () => {
    expect(audibleNow(fakeCtx(7.25))).toBe(7.25)
  })

  it('falls back before the context has rendered anything', () => {
    // Both halves read zero until the first quantum; interpolating that would
    // return a wall-clock reading as if it were a context time.
    expect(audibleNow(fakeCtx(0, { contextTime: 0, performanceTime: 0 }))).toBe(0)
  })
})
