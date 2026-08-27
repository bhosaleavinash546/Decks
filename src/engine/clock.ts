// Reading the audio clock from the main thread.
//
// `ctx.currentTime` describes the frame just RENDERED, which sits ahead of what
// is audible by the output latency — measured at 35.8 ms in the option 4 spike.
// `getOutputTimestamp()` describes the frame being HEARD and pairs it with a
// `performance.now()` reading, so it can be interpolated between updates. That
// is both latency-correct and smoother: 90.7 samples of step jitter against
// 242.5 for the raw clock.

/** Context time (seconds) of the audio the listener is hearing right now. */
export function audibleNow(ctx: BaseAudioContext): number {
  const anyCtx = ctx as AudioContext
  if (typeof anyCtx.getOutputTimestamp === 'function') {
    const ts = anyCtx.getOutputTimestamp()
    // Both halves are zero until the context has rendered something.
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000
    }
  }
  return ctx.currentTime
}

/** Context time of the frame just rendered. Use for SCHEDULING, not display. */
export function renderNow(ctx: BaseAudioContext): number {
  return ctx.currentTime
}
