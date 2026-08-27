// Mixer wiring.
//
// Phase 1 is one deck into a master gain into the destination. The EQ isolator,
// filter, crossfader, cue bus and limiter are Phase 2 and are deliberately not
// scaffolded here — §"do not scaffold ahead of specification".
//
// This is the only module allowed to narrow an IDeckSource to IAudioGraphDeck.
// Everything above it drives decks through setVolume alone.

import deckWorkletUrl from './worklets/deck-processor.ts?worker&url'
import { FileDeck } from './FileDeck.js'
import type { DeckId, IAudioGraphDeck, IDeckSource } from './IDeckSource.js'

export interface Mixer {
  readonly ctx: AudioContext
  readonly master: GainNode
  readonly decks: Map<DeckId, IDeckSource>
  createFileDeck(id: DeckId): Promise<FileDeck>
  /** Connect a deck's audio into the master bus, if it has any. */
  attach(deck: IDeckSource): void
  dispose(): void
}

function isAudioGraphDeck(deck: IDeckSource): deck is IAudioGraphDeck {
  return deck.kind === 'file' && 'output' in deck
}

let workletLoaded: Promise<void> | null = null

export async function ensureWorkletLoaded(ctx: BaseAudioContext): Promise<void> {
  workletLoaded ??= ctx.audioWorklet.addModule(deckWorkletUrl)
  await workletLoaded
}

export function createMixer(ctx: AudioContext): Mixer {
  const master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)
  const decks = new Map<DeckId, IDeckSource>()

  return {
    ctx,
    master,
    decks,

    async createFileDeck(id: DeckId): Promise<FileDeck> {
      await ensureWorkletLoaded(ctx)
      const node = new AudioWorkletNode(ctx, 'deck', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      const deck = new FileDeck(id, ctx, node)
      decks.set(id, deck)
      this.attach(deck)
      return deck
    },

    attach(deck: IDeckSource): void {
      // A YouTube deck has no output at all; it plays through its own iframe and
      // is driven by setVolume. Nothing here needs to special-case it.
      if (isAudioGraphDeck(deck)) deck.output.connect(master)
    },

    dispose(): void {
      for (const deck of decks.values()) deck.dispose()
      decks.clear()
      master.disconnect()
    },
  }
}

/** Test seam: the module registry is per-context in real use. */
export function __resetWorkletCache(): void {
  workletLoaded = null
}
