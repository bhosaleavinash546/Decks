// Non-audio state only. No playhead, no meters, no rate — anything that changes
// at frame rate is written through refs by the frame loop instead (§17.3).

import { create } from 'zustand'
import type { DeckError } from '../engine/errors.js'
import type { DeckId, DeckState } from '../engine/IDeckSource.js'

export interface DeckSummary {
  readonly title: string
  readonly state: DeckState
  readonly durationSec: number
}

interface UiState {
  banners: DeckError[]
  decks: Record<DeckId, DeckSummary>
  latencyMs: number
  outputLatencyMs: number
  maxChannelCount: number
  pushBanner: (e: DeckError) => void
  dismissBanner: (id: number) => void
  setDeck: (id: DeckId, summary: Partial<DeckSummary>) => void
  setEnvironment: (latencyMs: number, outputLatencyMs: number, maxChannelCount: number) => void
}

const emptyDeck: DeckSummary = { title: '', state: 'empty', durationSec: 0 }

export const useUiStore = create<UiState>((set) => ({
  banners: [],
  decks: { A: emptyDeck, B: emptyDeck },
  latencyMs: 0,
  outputLatencyMs: 0,
  maxChannelCount: 0,
  pushBanner: (e) => set((s) => ({ banners: [...s.banners.slice(-4), e] })),
  dismissBanner: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
  // Referentially stable when nothing changed. DeckPanel selects this object,
  // so handing back a fresh one every poll would re-render it during playback —
  // which §17.3 counts as a defect.
  setDeck: (id, summary) =>
    set((s) => {
      const prev = s.decks[id]
      const next = { ...prev, ...summary }
      if (prev.title === next.title && prev.state === next.state && prev.durationSec === next.durationSec) {
        return s
      }
      return { decks: { ...s.decks, [id]: next } }
    }),
  setEnvironment: (latencyMs, outputLatencyMs, maxChannelCount) =>
    set({ latencyMs, outputLatencyMs, maxChannelCount }),
}))
