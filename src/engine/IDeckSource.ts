// The seam that keeps the mixer from knowing what it is driving.
//
// The interface deliberately exposes no AudioNode. A YouTube deck has none, and
// if the interface promised one it would have to fake it — the mixer would then
// be driving a node connected to nothing. Instead it exposes intent
// (`setVolume`), and each deck decides what that means: a GainNode here, a
// `player.setVolume(v * 100)` there.

export type DeckId = 'A' | 'B'
export type DeckKind = 'file' | 'youtube'
export type DeckState = 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

/**
 * What a deck can actually do. The UI greys controls from this rather than
 * type-checking the deck, so the reason is attached to the capability (§19)
 * instead of scattered through components.
 */
export interface DeckCapabilities {
  readonly eq: boolean
  readonly filter: boolean
  readonly waveform: boolean
  readonly beatgrid: boolean
  readonly sync: boolean
  readonly keylock: boolean
  readonly loops: boolean
  readonly cue: boolean
  readonly recordable: boolean
  /** Shown on hover of any control this deck cannot do. */
  readonly unavailableReason: string
}

export interface DeckLoadRequest {
  readonly title: string
  readonly file?: File
  readonly url?: string
}

export interface IDeckSource {
  readonly id: DeckId
  readonly kind: DeckKind
  readonly capabilities: DeckCapabilities
  readonly state: DeckState
  readonly durationSec: number

  load(req: DeckLoadRequest): Promise<void>
  play(): void
  pause(): void
  /** Seconds from the start of the track. */
  seek(positionSec: number): void

  /** 0..1 fader position. The mixer's only volume verb. */
  setVolume(v: number): void

  /** Ratio, 1 = native. Ramped internally, never stepped — a step clicks. */
  setRate(rate: number): void

  /**
   * Seconds. Synchronous, allocation-free and cheap: the single rAF loop calls
   * this once per frame per deck. A file deck derives it from the audio clock;
   * a YouTube deck interpolates its last polled value.
   */
  getPositionSec(): number

  dispose(): void
}

/** Only decks whose audio is genuinely inside the Web Audio graph. */
export interface IAudioGraphDeck extends IDeckSource {
  readonly kind: 'file'
  /** Feeds Trim → EQ → filter → channel fader. */
  readonly output: AudioNode
}

export const FILE_DECK_CAPABILITIES: DeckCapabilities = {
  eq: true,
  filter: true,
  waveform: true,
  beatgrid: true,
  sync: true,
  keylock: true,
  loops: true,
  cue: true,
  recordable: true,
  unavailableReason: '',
}
