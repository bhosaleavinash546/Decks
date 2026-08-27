// A minimal stand-in for the worklet's render loop, driving the REAL shared
// RateFollower so the contract under test is the shipped one.
//
// Its two switches reproduce the exact anchor mistakes this spike hit while
// building option 4. Both are off-by-a-quantum errors, both are invisible
// without a test, and both would show up as a playhead that is slightly wrong
// forever.

import { RateFollower } from '../../src/engine/shared/rateFollower.js'

export const QUANTUM = 128

export interface SimOptions {
  readonly startFrame: number
  /** BUG 1: begin on the quantum boundary containing startFrame, not on it. */
  readonly startOnQuantumBoundary?: boolean
  /** BUG 2: report the playhead AFTER advancing, timestamped at quantum start. */
  readonly reportAfterAdvancing?: boolean
}

export interface TruthReport {
  readonly playhead: number
  readonly frame: number
  readonly contextTime: number
}

export class WorkletSim {
  #playhead = 0
  #follower = new RateFollower(1)
  #started = false
  readonly reports: TruthReport[] = []

  constructor(
    private readonly opts: SimOptions,
    private readonly sampleRate: number,
  ) {}

  get playhead(): number {
    return this.#playhead
  }

  rampTo(to: number, rampFrames: number): void {
    this.#follower.rampTo(to, rampFrames)
  }

  /** Render one quantum beginning at `currentFrame`, optionally reporting. */
  render(currentFrame: number, report = false): void {
    const before = this.#playhead
    const contextTime = currentFrame / this.sampleRate

    if (report && !this.opts.reportAfterAdvancing) {
      this.reports.push({ playhead: before, frame: currentFrame, contextTime })
    }

    for (let i = 0; i < QUANTUM; i++) {
      const frame = currentFrame + i
      if (!this.#started) {
        const begin = this.opts.startOnQuantumBoundary
          ? currentFrame // the whole quantum counts as playing
          : this.opts.startFrame
        if (frame < begin) continue
        if (currentFrame + QUANTUM <= this.opts.startFrame) continue
        this.#started = true
      }
      this.#playhead += this.#follower.step()
    }

    if (report && this.opts.reportAfterAdvancing) {
      // The bug: playhead has advanced a whole quantum, but the timestamp still
      // describes the START of that quantum.
      this.reports.push({ playhead: this.#playhead, frame: currentFrame, contextTime })
    }
  }
}
