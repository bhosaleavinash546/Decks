// The main thread's model of what the worklet is doing.
//
// Reads are O(1): each segment records the position it starts at, computed once
// when the segment is appended, so a 60 fps read never walks history. Segments
// older than the current time are pruned to one.

import { positionInSegment, rateInSegment, type RateSegment } from './ramp.js'

export class RateTimeline {
  #segments: RateSegment[]
  readonly #sampleRate: number

  constructor(sampleRate: number, startTime: number, startPosition = 0, rate = 1) {
    this.#sampleRate = sampleRate
    this.#segments = [{ startTime, startPosition, from: rate, to: rate, rampSec: 0 }]
  }

  /** Source-sample position at context time `t`. */
  positionAt(t: number): number {
    return positionInSegment(this.#segmentAt(t), t, this.#sampleRate)
  }

  /** Playback rate at context time `t`. */
  rateAt(t: number): number {
    return rateInSegment(this.#segmentAt(t), t)
  }

  /**
   * Schedule a rate change beginning at context time `at`. The identical change
   * must be sent to the worklet with the same start frame and ramp length.
   */
  changeRate(at: number, to: number, rampSec: number): RateSegment {
    const prev = this.#segmentAt(at)
    const seg: RateSegment = {
      startTime: at,
      startPosition: positionInSegment(prev, at, this.#sampleRate),
      from: rateInSegment(prev, at),
      to,
      rampSec,
    }
    this.#append(seg)
    return seg
  }

  /** Jump to a source position at context time `at` — a cue, seek or loop wrap. */
  seek(at: number, position: number): RateSegment {
    const rate = this.rateAt(at)
    const seg: RateSegment = { startTime: at, startPosition: position, from: rate, to: rate, rampSec: 0 }
    this.#append(seg)
    return seg
  }

  /**
   * Re-anchor onto the worklet's reported truth (HARD RULE 8). A dropped render
   * quantum makes the derived position run permanently ahead, and nothing else
   * in the system would ever notice.
   */
  reanchor(at: number, position: number): void {
    this.seek(at, position)
  }

  #segmentAt(t: number): RateSegment {
    const segs = this.#segments
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i]!.startTime <= t) return segs[i]!
    }
    return segs[0]!
  }

  #append(seg: RateSegment): void {
    this.#segments.push(seg)
    this.#segments.sort((a, b) => a.startTime - b.startTime)
    // Keep one segment behind the newest so a read timestamped just before a
    // scheduled change still lands in the right span.
    if (this.#segments.length > 4) this.#segments = this.#segments.slice(-4)
  }
}
