// THE requestAnimationFrame loop. One for the entire app (§17.1).
//
// Not one per deck, not one per component. It reads the engine and writes
// straight into refs and canvas uniforms. React is not involved: a render during
// playback is a defect (§17.3).

export type FrameSubscriber = (nowMs: number) => void

const subscribers = new Set<FrameSubscriber>()
let rafId = 0
let frames = 0

function tick(nowMs: number): void {
  frames++
  for (const fn of subscribers) {
    try {
      fn(nowMs)
    } catch {
      // A throwing subscriber must never stop the loop — the waveform and the
      // meters are the instrument, and the music never stops (§5.6).
    }
  }
  rafId = requestAnimationFrame(tick)
}

function start(): void {
  if (rafId === 0) rafId = requestAnimationFrame(tick)
}

export function subscribeFrame(fn: FrameSubscriber): () => void {
  subscribers.add(fn)
  start()
  return () => {
    subscribers.delete(fn)
  }
}

export function frameCount(): number {
  return frames
}

export function stopFrameLoop(): void {
  if (rafId !== 0) cancelAnimationFrame(rafId)
  rafId = 0
  subscribers.clear()
}

/**
 * The beat clock (§14.1). One clock, written here from the audio master clock.
 * Anything that pulses reads --beat-phase; nothing runs its own timer.
 * Phase 3 drives this from the beatgrid — for now it stays parked at 0.
 */
export function writeBeatPhase(phase: number): void {
  document.documentElement.style.setProperty('--beat-phase', String(phase))
}
