// The worklet's half of HARD RULE 9.
//
// RateTimeline integrates the rate curve in closed form for the main thread;
// this walks the identical curve one sample at a time for the worklet. They are
// two views of one contract, which is why they live side by side and why
// tests/unit/ramp.test.ts asserts the two agree to within a rounding error.

import { rampFirstRate, rampStepPerSample } from './ramp.js'

export class RateFollower {
  #rate: number
  #step = 0
  #remaining = 0
  #target: number

  constructor(rate = 1) {
    this.#rate = rate
    this.#target = rate
  }

  get rate(): number {
    return this.#rate
  }

  get ramping(): boolean {
    return this.#remaining > 0
  }

  /** Begin a linear ramp to `to` over `rampFrames` samples. */
  rampTo(to: number, rampFrames: number): void {
    const frames = Math.max(1, Math.round(rampFrames))
    this.#step = rampStepPerSample(this.#rate, to, frames)
    // Midpoint: sample i runs at from + (i + 0.5) * step, so the discrete sum
    // equals the trapezoid exactly. A left or right sum leaves half a step of
    // permanent error on every ramp, which a sync engine would accumulate.
    this.#rate = rampFirstRate(this.#rate, this.#step)
    this.#remaining = frames
    this.#target = to
  }

  /** Rate for this sample; advances the ramp by one sample. */
  step(): number {
    const rate = this.#rate
    if (this.#remaining > 0) {
      this.#remaining--
      this.#rate = this.#remaining === 0 ? this.#target : this.#rate + this.#step
    }
    return rate
  }
}
