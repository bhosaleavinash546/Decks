import { memo, useCallback, useRef, useState } from 'react'
import type { FileDeck } from '../../engine/FileDeck.js'
import type { DeckId } from '../../engine/IDeckSource.js'
import { useUiStore } from '../../store/uiStore.js'
import { Button } from '../controls/Button.js'
import { Readout } from '../controls/Readout.js'
import { clock } from '../format.js'
import { countRender } from '../renderCount.js'
import { PitchFader } from './PitchFader.js'

const DECK_TINT: Record<DeckId, string> = { A: 'var(--deck-a)', B: 'var(--deck-b)' }

export const DeckPanel = memo(function DeckPanel({ id, deck }: { id: DeckId; deck: FileDeck | null }) {
  countRender('DeckPanel')
  const summary = useUiStore((s) => s.decks[id])
  const setDeck = useUiStore((s) => s.setDeck)
  const [pitch, setPitch] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const readPosition = useCallback(() => clock(deck?.getPositionSec() ?? 0), [deck])
  const readRemaining = useCallback(
    () => clock((deck?.durationSec ?? 0) - (deck?.getPositionSec() ?? 0)),
    [deck],
  )
  // The event count alone cannot tell a dropped quantum from a benign clock
  // discontinuity. Frames lost can, so show both.
  const readXruns = useCallback(
    () => `${deck?.xruns ?? 0} · ${deck?.framesLost ?? 0} lost`,
    [deck],
  )

  const onPitch = useCallback(
    (percent: number) => {
      setPitch(percent)
      deck?.setRate(1 + percent / 100)
    },
    [deck],
  )

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !deck) return
      setDeck(id, { state: 'loading', title: file.name })
      await deck.load({ title: file.name, file })
      setDeck(id, { state: deck.state, title: deck.title, durationSec: deck.durationSec })
    },
    [deck, id, setDeck],
  )

  const playing = summary.state === 'playing'
  // Pressing Play mid-decode used to do nothing at all, silently. Disabled
  // controls are shown and explain themselves rather than no-opping (§16, §19).
  // A deck that already has a track keeps its transport while the NEXT one
  // decodes — locking out the controls of a playing deck is exactly the blocked
  // UI the prime directive forbids.
  const hasTrack = summary.durationSec > 0
  const busy = summary.state === 'empty' || (summary.state === 'loading' && !hasTrack)
  const busyReason = summary.state === 'loading' ? 'Still decoding this track' : 'Load a track first'

  return (
    <section
      className="panel"
      data-testid={`deck-${id}`}
      aria-label={`Deck ${id}`}
      style={{
        padding: 'var(--space-2)',
        borderLeft: `2px solid ${DECK_TINT[id]}`,
        display: 'grid',
        gap: 'var(--space-2)',
        minWidth: 320,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span className="legend" style={{ color: DECK_TINT[id] }}>
          Deck {id}
        </span>
        <span style={{ fontSize: 15 }} data-testid={`deck-${id}-title`}>
          {summary.title || 'No track loaded'}
        </span>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 'var(--space-2)', flex: 1 }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Readout read={readPosition} label="Elapsed" size={32} />
            <Readout read={readRemaining} label="Remaining" size={20} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => deck?.play()}
              active={playing}
              disabled={busy}
              reason={busyReason}
              data-testid={`deck-${id}-play`}
            >
              Play
            </Button>
            <Button
              onClick={() => deck?.pause()}
              disabled={busy}
              reason={busyReason}
              data-testid={`deck-${id}-pause`}
            >
              Pause
            </Button>
            <Button
              onClick={() => deck?.seek(0)}
              disabled={busy}
              reason={busyReason}
              data-testid={`deck-${id}-cue`}
            >
              Cue
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Readout
              read={readXruns}
              label="Xruns · frames lost"
              size={13}
              title="Clock discontinuities, and how many render frames were actually lost"
            />
          </div>

          <label className="legend" style={{ display: 'grid', gap: 4 }}>
            Load a track
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              data-testid={`deck-${id}-file`}
              onChange={(e) => void onFile(e.target.files?.[0])}
              style={{ fontSize: 11 }}
            />
          </label>
        </div>

        <PitchFader value={pitch} onChange={onPitch} />
      </div>
    </section>
  )
})
