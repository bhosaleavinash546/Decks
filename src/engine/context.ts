// The single AudioContext.
//
// One context, always. Two contexts mean two clocks and guaranteed drift, which
// is why the cue bus is a channel routing problem and never a second context.

import { reportError } from './errors.js'

export interface AudioEnvironment {
  readonly ctx: AudioContext
  /** Output channels the device reports. 2 on built-in Mac output. */
  readonly maxChannelCount: number
}

let env: AudioEnvironment | null = null

export function createEnvironment(): AudioEnvironment {
  if (env) return env
  // Never latencyHint 0 — it causes dropouts (§13).
  const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })
  const maxChannelCount = ctx.destination.maxChannelCount

  // Two channels is the expected case on this machine, not a failure. Split cue
  // (Path A) is built on it in Phase 2; the 4-channel merger lands in Phase 9
  // if hardware ever reports it.
  const channelCount = Math.min(4, maxChannelCount)
  try {
    ctx.destination.channelCount = channelCount
    ctx.destination.channelCountMode = 'explicit'
    ctx.destination.channelInterpretation = 'discrete'
  } catch (cause) {
    reportError('Could not set the output channel layout', cause)
  }

  env = { ctx, maxChannelCount }
  return env
}

export function getEnvironment(): AudioEnvironment | null {
  return env
}

/** Autoplay policy requires a gesture; call this from a real click. */
export async function resumeOnGesture(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch (cause) {
      reportError('Could not start audio — click anywhere to retry', cause)
    }
  }
}

/** baseLatency + outputLatency, in milliseconds. Displayed in the transport. */
export function totalLatencyMs(ctx: AudioContext): number {
  return (ctx.baseLatency + (ctx.outputLatency || 0)) * 1000
}

/** Test seam. */
export function __resetEnvironment(): void {
  env = null
}
