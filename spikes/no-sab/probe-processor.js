// Option 4 probe: a deck processor with no SharedArrayBuffer anywhere.
//
// PCM arrives once as a TRANSFERRED ArrayBuffer (port.postMessage with a
// transfer list — processorOptions would copy it instead). The playhead lives
// here and is never published per frame; the main thread derives it from the
// audio clock. This worklet reports its true playhead once per second purely so
// the spike can measure the drift. A shipping deck would not need even that.

const REPORT_INTERVAL_SEC = 1

class ProbeProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const o = options.processorOptions

    // Everything allocated here, never in process().
    this.pcm = null
    this.playhead = 0 // float64 source-sample position
    this.rate = 1
    this.rampStep = 0
    this.rampRemaining = 0
    this.pendingRate = null // { atFrame, rate, rampFrames }
    this.startFrame = o.startFrame
    this.nextReportFrame = o.startFrame
    this.impulseEverySec = o.impulseEverySec ?? 5
    this.nextImpulseFrame = o.startFrame + this.impulseEverySec * sampleRate
    this.xruns = 0
    this.expectedFrame = -1
    this.actualStartFrame = -1
    this.impulsesEmitted = 0
    this.report = { playhead: 0, contextTime: 0, frame: 0, xruns: 0, rate: 1, impulsesEmitted: 0 }

    this.port.onmessage = (e) => {
      const m = e.data
      if (m.type === 'pcm') {
        this.pcm = new Float32Array(m.pcm)
      } else if (m.type === 'rate') {
        // Deferred to an exact frame so the main thread can model the identical
        // ramp. Starting it on message arrival would put the two integrals on
        // different clocks.
        this.pendingRate = {
          atFrame: m.atFrame,
          rate: m.rate,
          rampFrames: Math.max(1, Math.round(m.rampSec * sampleRate)),
        }
      }
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    const left = out[0]
    const right = out[1] ?? out[0]
    const n = left.length

    // A gap in currentFrame means the audio thread missed a render quantum.
    if (this.expectedFrame >= 0 && currentFrame !== this.expectedFrame) this.xruns++
    this.expectedFrame = currentFrame + n

    if (!this.pcm || currentFrame + n <= this.startFrame) {
      left.fill(0)
      if (right !== left) right.fill(0)
      return true
    }

    // Reported BEFORE the loop advances, so playhead and currentTime describe
    // the same instant — the start of this quantum.
    if (currentFrame >= this.nextReportFrame) {
      this.nextReportFrame += REPORT_INTERVAL_SEC * sampleRate
      const r = this.report
      r.playhead = this.playhead
      r.contextTime = currentTime
      r.frame = currentFrame
      r.xruns = this.xruns
      r.rate = this.rate
      r.impulsesEmitted = this.impulsesEmitted
      // Once per second is event rate, not frame rate.
      this.port.postMessage(r)
    }

    const pcm = this.pcm
    const len = pcm.length

    // Begin on the exact scheduled sample, not on the quantum boundary that
    // contains it, so the anchor the main thread assumes is the anchor we use.
    const startOffset = Math.max(0, this.startFrame - currentFrame)
    if (this.actualStartFrame < 0) {
      this.actualStartFrame = currentFrame + startOffset
      this.port.postMessage({ started: true, frame: this.actualStartFrame })
    }

    for (let i = 0; i < n; i++) {
      const frame = currentFrame + i
      if (i < startOffset) {
        left[i] = 0
        if (right !== left) right[i] = 0
        continue
      }

      const p = this.pendingRate
      if (p !== null && frame >= p.atFrame) {
        this.rampStep = (p.rate - this.rate) / p.rampFrames
        this.rampRemaining = p.rampFrames
        this.pendingRate = null
      }
      if (this.rampRemaining > 0) {
        this.rate += this.rampStep
        this.rampRemaining--
      }

      // Nearest-sample read: this spike measures the clock, not interpolation.
      const s = pcm[this.playhead % len | 0]
      left[i] = s
      if (right !== left) right[i] = s
      this.playhead += this.rate
    }

    // One full-scale sample, to prove a main-thread AnalyserNode catches a peak
    // it could only miss if it were sampling with gaps.
    if (currentFrame >= this.nextImpulseFrame) {
      left[0] = 0.999
      if (right !== left) right[0] = 0.999
      this.nextImpulseFrame += this.impulseEverySec * sampleRate
      this.impulsesEmitted++
    }

    return true
  }
}

registerProcessor('probe', ProbeProcessor)
