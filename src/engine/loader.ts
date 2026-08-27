// File intake: pick a file, decode it, hand the PCM to the worklet.
//
// The handoff is a TRANSFER, not a copy or a share. After it the main thread's
// view is detached, so the audio is resident exactly once. Anything the UI needs
// from the samples — waveform peaks, later the analysis worker's input — has to
// be taken BEFORE the transfer.

import { reportError } from './errors.js'

export interface DecodedTrack {
  readonly title: string
  readonly channels: Float32Array[]
  readonly lengthSamples: number
  readonly durationSec: number
  readonly sampleRate: number
}

export async function decodeFile(ctx: BaseAudioContext, file: File): Promise<DecodedTrack | null> {
  try {
    const bytes = await file.arrayBuffer()
    // decodeAudioData resamples to the context rate, so the worklet's playhead
    // is always in context samples regardless of the file's own rate.
    const buf = await ctx.decodeAudioData(bytes)
    const channels: Float32Array[] = []
    for (let c = 0; c < buf.numberOfChannels; c++) {
      // getChannelData returns a view into the AudioBuffer; copy so the buffer
      // itself can be released and so the copy is transferable.
      channels.push(new Float32Array(buf.getChannelData(c)))
    }
    return {
      title: file.name.replace(/\.[^.]+$/, ''),
      channels,
      lengthSamples: buf.length,
      durationSec: buf.duration,
      sampleRate: buf.sampleRate,
    }
  } catch (cause) {
    reportError(`Could not read ${file.name} — is it an audio file Chrome can decode?`, cause)
    return null
  }
}

/** The ArrayBuffers to hand over, and the transfer list that moves them. */
export function transferable(track: DecodedTrack): { channels: ArrayBuffer[]; transfer: ArrayBuffer[] } {
  const channels = track.channels.map((c) => c.buffer as ArrayBuffer)
  return { channels, transfer: channels }
}
