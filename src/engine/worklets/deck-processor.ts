/// <reference lib="webworker" />
// The file deck's sample player.
//
// HARD RULE: no allocations and no console.log inside process(). Everything is
// pre-allocated at construction or on load.
//
// PCM arrives as transferred ArrayBuffers — one per channel, moved not copied,
// so the main thread's view is detached afterwards and the audio is resident
// exactly once.
//
// The playhead lives here and is NOT published per frame. The main thread
// derives it from the audio clock (see clock.ts and shared/ramp.ts). The 1 Hz
// truth report below exists so that a dropped render quantum, which would make
// the derived position permanently early, gets corrected (HARD RULE 8).

import { hermite4 } from '../dsp/interpolate.js'
import { RateFollower } from '../shared/rateFollower.js'

declare const sampleRate: number
declare const currentFrame: number
declare const currentTime: number
declare function registerProcessor(name: string, ctor: typeof DeckProcessor): void
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}

const TRUTH_INTERVAL_SEC = 1

interface PendingRate {
  atFrame: number
  to: number
  rampFrames: number
}

class DeckProcessor extends AudioWorkletProcessor {
  #channels: Float32Array[] = []
  #length = 0
  #playhead = 0 // float64 source-sample position; float32 dies past ~16M samples
  #follower = new RateFollower(1)
  #pendingRate: PendingRate | null = null
  #playing = false
  #playAtFrame = -1
  #pauseAtFrame = -1
  #seek: { atFrame: number; position: number } | null = null
  #nextTruthFrame = 0
  #xruns = 0
  #framesLost = 0
  #expectedFrame = -1

  // One reused object: the only thing process() hands to postMessage.
  readonly #truth = {
    type: 'truth' as const,
    playhead: 0,
    contextTime: 0,
    frame: 0,
    xruns: 0,
    framesLost: 0,
    rate: 1,
    playing: false,
  }

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent) => this.#onMessage(e.data)
  }

  #onMessage(m: any): void {
    switch (m.type) {
      case 'load':
        this.#channels = (m.channels as ArrayBuffer[]).map((b) => new Float32Array(b))
        this.#length = this.#channels[0]?.length ?? 0
        this.#playhead = m.position ?? 0
        this.#follower = new RateFollower(1)
        this.#playing = false
        this.port.postMessage({ type: 'loaded', lengthSamples: this.#length })
        break
      case 'play':
        this.#playAtFrame = m.atFrame
        break
      case 'pause':
        this.#pauseAtFrame = m.atFrame
        break
      case 'seek':
        this.#seek = { atFrame: m.atFrame, position: m.position }
        break
      case 'rate':
        // Deferred to an exact frame so the main thread's closed-form integral
        // and this per-sample ramp describe the same curve.
        this.#pendingRate = { atFrame: m.atFrame, to: m.to, rampFrames: Math.max(1, m.rampFrames) }
        break
    }
  }

  #sampleAt(ch: Float32Array, pos: number): number {
    const i = Math.floor(pos)
    const frac = pos - i
    const n = this.#length
    // Clamped at the edges rather than wrapped: a deck is not a loop by default.
    const y0 = ch[i - 1 < 0 ? 0 : i - 1]!
    const y1 = ch[i < 0 ? 0 : i >= n ? n - 1 : i]!
    const y2 = ch[i + 1 >= n ? n - 1 : i + 1]!
    const y3 = ch[i + 2 >= n ? n - 1 : i + 2]!
    return hermite4(y0, y1, y2, y3, frac)
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]!
    const n = out[0]!.length

    // A gap in currentFrame means the audio thread missed a render quantum.
    if (this.#expectedFrame >= 0 && currentFrame !== this.#expectedFrame) {
      this.#xruns++
      // The count alone cannot distinguish a genuinely dropped quantum from a
      // benign clock discontinuity. The GAP can: frames actually lost is what
      // makes the playhead wrong.
      this.#framesLost += currentFrame - this.#expectedFrame
    }
    this.#expectedFrame = currentFrame + n

    if (currentFrame >= this.#nextTruthFrame) {
      // Emitted BEFORE the loop advances, so playhead and contextTime describe
      // the same instant. Reporting after the loop is off by one quantum — a
      // bug this spike hit once and the unit tests now pin.
      this.#nextTruthFrame = currentFrame + TRUTH_INTERVAL_SEC * sampleRate
      const t = this.#truth
      t.playhead = this.#playhead
      t.contextTime = currentTime
      t.frame = currentFrame
      t.xruns = this.#xruns
      t.framesLost = this.#framesLost
      t.rate = this.#follower.rate
      t.playing = this.#playing
      this.port.postMessage(t)
    }

    const chans = this.#channels
    const nOut = out.length
    if (chans.length === 0) {
      for (let c = 0; c < nOut; c++) out[c]!.fill(0)
      return true
    }
    const left = chans[0]!
    const right = chans[1] ?? left

    for (let i = 0; i < n; i++) {
      const frame = currentFrame + i

      // Transport edges land on their exact scheduled sample, not on the
      // quantum boundary that happens to contain them.
      if (this.#playAtFrame >= 0 && frame >= this.#playAtFrame) {
        this.#playing = true
        this.#playAtFrame = -1
      }
      if (this.#pauseAtFrame >= 0 && frame >= this.#pauseAtFrame) {
        this.#playing = false
        this.#pauseAtFrame = -1
      }
      const sk = this.#seek
      if (sk !== null && frame >= sk.atFrame) {
        this.#playhead = sk.position
        this.#seek = null
      }
      const pr = this.#pendingRate
      if (pr !== null && frame >= pr.atFrame) {
        this.#follower.rampTo(pr.to, pr.rampFrames)
        this.#pendingRate = null
      }

      if (!this.#playing) {
        for (let c = 0; c < nOut; c++) out[c]![i] = 0
        continue
      }

      const p = this.#playhead
      if (p < 0 || p >= this.#length) {
        for (let c = 0; c < nOut; c++) out[c]![i] = 0
        continue
      }

      out[0]![i] = this.#sampleAt(left, p)
      if (nOut > 1) out[1]![i] = this.#sampleAt(right, p)

      this.#playhead = p + this.#follower.step()
    }
    return true
  }
}

registerProcessor('deck', DeckProcessor)
