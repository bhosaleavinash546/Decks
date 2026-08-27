import { afterEach, describe, expect, it, vi } from 'vitest'
import { frameCount, stopFrameLoop, subscribeFrame } from '../../src/ui/frame/frameLoop.js'

// A hand-driven rAF so the loop can be stepped deterministically.
function installRaf() {
  const queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  return {
    step(t = 0) {
      const due = queue.splice(0, queue.length)
      for (const cb of due) cb(t)
    },
  }
}

afterEach(() => {
  stopFrameLoop()
  vi.unstubAllGlobals()
})

describe('the single frame loop', () => {
  it('runs every subscriber on each frame', () => {
    const raf = installRaf()
    const a = vi.fn()
    const b = vi.fn()
    subscribeFrame(a)
    subscribeFrame(b)
    raf.step(16)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('keeps running when a subscriber throws — the music never stops', () => {
    const raf = installRaf()
    const survivor = vi.fn()
    subscribeFrame(() => {
      throw new Error('a readout blew up')
    })
    subscribeFrame(survivor)
    const before = frameCount()

    raf.step(16)
    raf.step(32)

    // The throwing subscriber did not take the loop, or its neighbours, down.
    expect(survivor).toHaveBeenCalledTimes(2)
    expect(frameCount()).toBe(before + 2)
  })

  it('stops calling a subscriber once unsubscribed', () => {
    const raf = installRaf()
    const fn = vi.fn()
    const off = subscribeFrame(fn)
    raf.step(16)
    off()
    raf.step(32)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('schedules exactly one rAF regardless of subscriber count', () => {
    const raf = installRaf()
    subscribeFrame(() => {})
    subscribeFrame(() => {})
    subscribeFrame(() => {})
    const calls: number[] = []
    subscribeFrame(() => calls.push(1))
    raf.step(16)
    // One frame, one pass — not one loop per subscriber (§17.1).
    expect(calls).toHaveLength(1)
  })
})
