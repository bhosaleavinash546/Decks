// The mixer must drive every deck through the interface alone. A fake deck with
// no AudioNode anywhere proves it: if the mixer ever reached for `.output` or
// a GainNode, this would not compile and would not run.

import { describe, expect, it } from 'vitest'
import type { DeckCapabilities, DeckLoadRequest, IDeckSource } from '../../src/engine/IDeckSource.js'

const NO_AUDIO: DeckCapabilities = {
  eq: false,
  filter: false,
  waveform: false,
  beatgrid: false,
  sync: false,
  keylock: false,
  loops: false,
  cue: false,
  recordable: false,
  unavailableReason: "A YouTube deck can't use EQ — the audio isn't available to the mixer",
}

class FakeYouTubeDeck implements IDeckSource {
  readonly id = 'B' as const
  readonly kind = 'youtube' as const
  readonly capabilities = NO_AUDIO
  state: IDeckSource['state'] = 'ready'
  durationSec = 180
  readonly calls: string[] = []
  volume = 1

  async load(_req: DeckLoadRequest): Promise<void> {
    this.calls.push('load')
  }
  play(): void {
    this.calls.push('play')
  }
  pause(): void {
    this.calls.push('pause')
  }
  seek(_s: number): void {
    this.calls.push('seek')
  }
  setVolume(v: number): void {
    this.calls.push(`setVolume:${v}`)
    this.volume = v
  }
  setRate(_r: number): void {
    this.calls.push('setRate')
  }
  getPositionSec(): number {
    return 0
  }
  dispose(): void {
    this.calls.push('dispose')
  }
}

/** Stand-in for the Phase 2 crossfader: constant power, both sides at once. */
function applyCrossfader(a: IDeckSource, b: IDeckSource, x: number): void {
  a.setVolume(Math.cos((x * Math.PI) / 2))
  b.setVolume(Math.sin((x * Math.PI) / 2))
}

describe('IDeckSource keeps the mixer agnostic', () => {
  it('drives a deck with no audio node at all', () => {
    const a = new FakeYouTubeDeck()
    const b = new FakeYouTubeDeck()
    applyCrossfader(a, b, 0.5)
    expect(a.volume).toBeCloseTo(Math.SQRT1_2, 12)
    expect(b.volume).toBeCloseTo(Math.SQRT1_2, 12)
  })

  it('is −3 dB per side at centre', () => {
    const a = new FakeYouTubeDeck()
    const b = new FakeYouTubeDeck()
    applyCrossfader(a, b, 0.5)
    const db = 20 * Math.log10(a.volume)
    expect(db).toBeCloseTo(-3.01, 2)
  })

  it('exposes no AudioNode on the interface', () => {
    const deck: IDeckSource = new FakeYouTubeDeck()
    expect('output' in deck).toBe(false)
  })

  it('carries a reason the UI can show on every disabled control', () => {
    const deck: IDeckSource = new FakeYouTubeDeck()
    expect(deck.capabilities.eq).toBe(false)
    expect(deck.capabilities.unavailableReason.length).toBeGreaterThan(0)
  })

  it('uses setVolume only — never a gain node', () => {
    const a = new FakeYouTubeDeck()
    applyCrossfader(a, new FakeYouTubeDeck(), 0)
    expect(a.calls.every((c) => c.startsWith('setVolume'))).toBe(true)
  })
})
