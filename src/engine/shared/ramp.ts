// The rate curve, defined once and integrated identically on both sides.
//
// HARD RULE 9. The worklet advances its playhead sample by sample; the main
// thread derives position by integrating the same curve in closed form. If the
// two ever describe different curves the derived playhead is quietly wrong, and
// the error accumulates on every rate change a sync engine makes.
//
// Both sides import this file. Nothing here touches the DOM or the audio graph,
// so the worklet can import it too.

/** A span of playback beginning at a known context time and source position. */
export interface RateSegment {
  /** AudioContext time (seconds) at which this segment begins. */
  readonly startTime: number
  /** Source-sample position at startTime. */
  readonly startPosition: number
  /** Rate entering the ramp. */
  readonly from: number
  /** Rate once the ramp completes. */
  readonly to: number
  /** Linear ramp duration in seconds; 0 for an instant segment. */
  readonly rampSec: number
}

/**
 * Source-sample position at context time `t` within a single segment.
 *
 * The ramp is linear from `from` to `to` over `rampSec`, so its contribution is
 * the trapezoid `rampSec * (from + to) / 2`; the remainder runs flat at `to`.
 */
export function positionInSegment(seg: RateSegment, t: number, sampleRate: number): number {
  const span = t - seg.startTime
  if (span <= 0) return seg.startPosition
  const ramp = Math.min(span, seg.rampSec)
  const ramped = ramp * ((seg.from + seg.to) / 2)
  const flat = (span - ramp) * seg.to
  return seg.startPosition + (ramped + flat) * sampleRate
}

/**
 * Instantaneous rate at context time `t`.
 *
 * A zero-length ramp is already complete at its own start time: asking for the
 * rate at exactly `startTime` must return `to`, not `from`. Getting that
 * backwards made pause() capture the pre-pause rate and the deck never stopped.
 */
export function rateInSegment(seg: RateSegment, t: number): number {
  const span = t - seg.startTime
  if (span < 0) return seg.from
  if (seg.rampSec <= 0 || span >= seg.rampSec) return seg.to
  return seg.from + ((seg.to - seg.from) * span) / seg.rampSec
}

/**
 * Per-sample increment the worklet adds to its rate during a ramp.
 *
 * The worklet starts at `from + step / 2` and adds `step` per sample, so sample
 * i runs at `from + (i + 0.5) * step`. Summed over N samples that is exactly the
 * trapezoid above — a midpoint rule, not a left or right Riemann sum, which
 * would each leave half a step of permanent error per ramp.
 */
export function rampStepPerSample(from: number, to: number, rampFrames: number): number {
  if (rampFrames <= 0) return 0
  return (to - from) / rampFrames
}

/** Rate the worklet should start the ramp at, given the step. See above. */
export function rampFirstRate(from: number, step: number): number {
  return from + step / 2
}
