// A deck backed by the worklet sample player.
//
// The playhead is NOT read back from the worklet. It is derived from the audio
// clock through RateTimeline, which integrates the same rate curve the worklet
// walks sample by sample. The worklet's 1 Hz truth report only corrects for
// dropped render quanta (HARD RULE 8).

import { audibleNow, renderNow } from './clock.js'
import { reportError } from './errors.js'
import {
  FILE_DECK_CAPABILITIES,
  type DeckCapabilities,
  type DeckId,
  type DeckLoadRequest,
  type DeckState,
  type IAudioGraphDeck,
} from './IDeckSource.js'
import { decodeFile, transferable } from './loader.js'
import { RateTimeline } from './shared/timeline.js'

/** Rate changes ramp; an instant step clicks (§8). */
const RATE_RAMP_SEC = 0.012
/** Transport edges are scheduled slightly ahead so they land on a known frame. */
const SCHEDULE_LEAD_SEC = 0.02
/** Beyond this the derived position is wrong enough to correct visibly. */
const REANCHOR_THRESHOLD_SAMPLES = 32

export interface TruthReport {
  readonly playhead: number
  readonly contextTime: number
  readonly xruns: number
  readonly playing: boolean
}

export class FileDeck implements IAudioGraphDeck {
  readonly kind = 'file' as const
  readonly capabilities: DeckCapabilities = FILE_DECK_CAPABILITIES

  #state: DeckState = 'empty'
  #node: AudioWorkletNode
  #gain: GainNode
  #ctx: AudioContext
  #timeline: RateTimeline
  #lengthSamples = 0
  #durationSec = 0
  #rate = 1
  #playing = false
  #xruns = 0
  #framesLost = 0
  #lastDriftSamples = 0
  #title = ''

  constructor(
    readonly id: DeckId,
    ctx: AudioContext,
    node: AudioWorkletNode,
  ) {
    this.#ctx = ctx
    this.#node = node
    this.#gain = ctx.createGain()
    this.#gain.gain.value = 1
    node.connect(this.#gain)
    this.#timeline = new RateTimeline(ctx.sampleRate, ctx.currentTime, 0, 0)
    node.port.onmessage = (e: MessageEvent) => this.#onWorkletMessage(e.data)
    node.onprocessorerror = () => {
      // The worklet died. Surface it, never throw — another deck may be playing.
      this.#state = 'error'
      reportError(`Deck ${this.id} stopped unexpectedly`)
    }
  }

  get state(): DeckState {
    return this.#state
  }
  get durationSec(): number {
    return this.#durationSec
  }
  get output(): AudioNode {
    return this.#gain
  }
  get title(): string {
    return this.#title
  }
  get xruns(): number {
    return this.#xruns
  }
  /** Render quanta the audio thread actually skipped. Zero means the xrun count
   *  is clock discontinuity rather than lost audio. */
  get framesLost(): number {
    return this.#framesLost
  }
  /** How far the derived playhead was off at the last truth report, in samples. */
  get driftSamples(): number {
    return this.#lastDriftSamples
  }
  get rate(): number {
    return this.#rate
  }

  async load(req: DeckLoadRequest): Promise<void> {
    if (!req.file) {
      reportError('Nothing to load — pick an audio file')
      return
    }
    // A failed load must leave the deck exactly as it was. Guessing 'paused'
    // here made a deck that was still playing claim it had stopped.
    const previous = this.#state
    this.#state = 'loading'
    const track = await decodeFile(this.#ctx, req.file)
    if (!track) {
      this.#state = previous === 'loading' ? 'empty' : previous
      return
    }
    const { channels, transfer } = transferable(track)
    this.#node.port.postMessage({ type: 'load', channels, position: 0 }, transfer)
    this.#lengthSamples = track.lengthSamples
    this.#durationSec = track.durationSec
    this.#title = track.title
    this.#rate = 1
    this.#playing = false
    // Rate 0: stopped. The worklet is silent until play(), and the derived
    // playhead must say so rather than running on its own.
    this.#timeline = new RateTimeline(this.#ctx.sampleRate, renderNow(this.#ctx), 0, 0)
    this.#state = 'ready'
  }

  play(): void {
    if (this.#state === 'empty' || this.#state === 'loading') return
    const at = renderNow(this.#ctx) + SCHEDULE_LEAD_SEC
    // Pausing parks the timeline at rate 0, so resuming is a rate change back to
    // the deck's rate. Position carries across automatically: the new segment
    // starts at wherever the previous one had reached.
    this.#timeline.changeRate(at, this.#rate, 0)
    this.#node.port.postMessage({ type: 'play', atFrame: this.#frameAt(at) })
    this.#playing = true
    this.#state = 'playing'
  }

  pause(): void {
    if (this.#state !== 'playing') return
    const at = renderNow(this.#ctx) + SCHEDULE_LEAD_SEC
    this.#node.port.postMessage({ type: 'pause', atFrame: this.#frameAt(at) })
    this.#playing = false
    this.#state = 'paused'
    // Rate 0 from `at` onwards freezes the derived position exactly where the
    // previous segment had reached.
    this.#timeline.changeRate(at, 0, 0)
  }

  seek(positionSec: number): void {
    const at = renderNow(this.#ctx) + SCHEDULE_LEAD_SEC
    const position = Math.max(0, Math.min(this.#lengthSamples, positionSec * this.#ctx.sampleRate))
    this.#node.port.postMessage({ type: 'seek', atFrame: this.#frameAt(at), position })
    this.#timeline.seek(at, position)
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v))
    // A short ramp, not a step: setValueAtTime on a fader zippers.
    this.#gain.gain.setTargetAtTime(clamped, renderNow(this.#ctx), 0.005)
  }

  setRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return
    const at = renderNow(this.#ctx) + SCHEDULE_LEAD_SEC
    // Derive rampSec FROM the frame count so both sides describe one curve.
    const rampFrames = Math.max(1, Math.round(RATE_RAMP_SEC * this.#ctx.sampleRate))
    const rampSec = rampFrames / this.#ctx.sampleRate
    this.#timeline.changeRate(at, rate, rampSec)
    this.#node.port.postMessage({ type: 'rate', atFrame: this.#frameAt(at), to: rate, rampFrames })
    this.#rate = rate
  }

  getPositionSec(): number {
    if (this.#lengthSamples === 0) return 0
    const pos = this.#timeline.positionAt(audibleNow(this.#ctx))
    return Math.max(0, Math.min(this.#durationSec, pos / this.#ctx.sampleRate))
  }

  dispose(): void {
    this.#node.port.onmessage = null
    try {
      this.#node.disconnect()
      this.#gain.disconnect()
    } catch {
      // Already torn down; nothing to do and nothing worth surfacing.
    }
  }

  #frameAt(contextTime: number): number {
    return Math.round(contextTime * this.#ctx.sampleRate)
  }

  #onWorkletMessage(m: any): void {
    if (m?.type !== 'truth') return
    this.#xruns = m.xruns
    this.#framesLost = m.framesLost ?? 0
    if (!m.playing || !this.#playing) return
    const derived = this.#timeline.positionAt(m.contextTime)
    const drift = derived - m.playhead
    this.#lastDriftSamples = drift
    // HARD RULE 8: a dropped quantum leaves the derived position permanently
    // early, and nothing else in the system would notice.
    if (Math.abs(drift) > REANCHOR_THRESHOLD_SAMPLES) {
      this.#timeline.reanchor(m.contextTime, m.playhead)
    }
  }
}
