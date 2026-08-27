# DECKS

A two-deck DJ application for house parties. One machine, one user, Chrome on a
MacBook Air M4. Not distributed, not sold, not a product.

**The core job:** two songs loaded, one playing. Bring the second one in, fade
the first one down, don't kill the party.

Read `docs/00-BUILD-BRIEF.md` before writing anything. The spike findings in
`docs/spikes/` are not history — they are the reasons two of the hard rules
below say what they say.

---

## Prime directive

**The music never stops.** A dropout at a party is worse than a missing feature.
Every design decision defers to that.

---

## Hard rules

1. **No `AudioBufferSourceNode` for file decks.** A custom `AudioWorkletProcessor`,
   because `AudioBufferSourceNode` cannot do sample-accurate looping or clean cue
   jumps.

2. **No SharedArrayBuffer, and no audio state in React state.** PCM reaches the
   worklet as a transferred `ArrayBuffer` at load. The playhead is *derived* on
   the main thread by integrating the rate curve against the audio clock — never
   read back per frame. Meters come from an `AnalyserNode`.
   *Why: `docs/spikes/02-no-sab-derived-playhead.md`. Over ten minutes and thirty
   rate changes the derived playhead tracked the worklet's true position to 0.041
   samples.*

3. **No allocations or `console.log` inside `process()`.** Pre-allocate
   everything at construction.

4. **No COOP/COEP headers. The document must not be cross-origin isolated.**
   Isolation is required only by SharedArrayBuffer, which rule 2 removed. Adding
   it back would force every third-party iframe into a credentialless — signed
   out — context, which means ads mid-track on a Premium account.
   *Why: `docs/spikes/01-coep-iframe.md`.*

5. **Deck sources sit behind `IDeckSource`.** The mixer never knows whether it is
   driving a gain node or a YouTube player. The interface exposes no `AudioNode`.

6. **The music never stops.** Any error, any failed load, any exception — the
   currently playing deck keeps playing. Errors surface as a banner, never a
   modal, never a blocked UI.

7. **Every DSP module gets a unit test** against reference vectors: silence in →
   silence out, sine in → expected magnitude.

8. **The worklet reports its true playhead once per second, and the deck
   re-anchors on it.** A dropped render quantum leaves the derived position
   permanently early and nothing else in the system would notice. Once per second
   is event rate, not frame rate, and it doubles as the xrun detector.

9. **Both sides integrate the same ramp curve.** `shared/ramp.ts` defines it,
   `RateTimeline` integrates it in closed form for the main thread and
   `RateFollower` walks it per sample for the worklet. Rate changes are scheduled
   at an agreed frame, never applied on message arrival. A left or right Riemann
   sum instead of the midpoint leaves half a step of permanent error per ramp,
   which a sync engine accumulates.

---

## Anti-patterns

- Any attempt at Spotify integration, official or otherwise
- Downloading or ripping audio from YouTube
- `<audio>` elements or `AudioBufferSourceNode` for file decks
- `ScriptProcessorNode`
- `postMessage` per audio frame, or allocations in `process()`
- Playhead stored as float32
- Two `AudioContext`s for master and cue
- React re-rendering on playhead updates
- Multiple `requestAnimationFrame` loops
- Anything pulsing on a wall-clock timer instead of the beat clock
- Pretending a YouTube deck has features it doesn't
- Modal dialogs during playback
- Adding a feature before the previous phase's tests pass
- **Putting the YouTube player in a second window to dodge isolation.** An iframe
  is third-party regardless of which window hosts it, so a second window buys
  nothing on ads and costs a window someone can close. Tab capture (§2.3 of the
  brief) is the designated fallback.

---

## Commands

```bash
npm run dev        # vite dev server on :5173
npm test           # unit tests (vitest)
npm run test:e2e   # acceptance tests, excluding the soak
npm run soak       # the ten-minute soak on its own
npm run lint       # eslint + tsc --noEmit
npm run fonts      # refetch and self-host the design system's faces
npm run build      # production build
```

`npm run lint` and `npm test` must both pass before any commit is proposed.

---

## Where things live

```
src/
├─ engine/
│  ├─ IDeckSource.ts          the seam; exposes no AudioNode
│  ├─ FileDeck.ts             worklet-backed deck, derived playhead
│  ├─ session.ts              the engine, created once per page
│  ├─ graph.ts                mixer wiring; the ONLY place that narrows to IAudioGraphDeck
│  ├─ clock.ts                getOutputTimestamp interpolation
│  ├─ loader.ts               decode, then transfer PCM
│  ├─ shared/                 ramp.ts · rateFollower.ts · timeline.ts — HARD RULE 9
│  ├─ worklets/               deck-processor.ts
│  └─ dsp/                    interpolate.ts
├─ ui/
│  ├─ tokens.css              the whole design system
│  ├─ frame/frameLoop.ts      THE rAF loop — one for the app
│  ├─ gallery/                /dev/gallery
│  └─ controls/ · deck/ · transport/
├─ store/                     zustand — non-audio state only
└─ pwa/                       manifest registration, wake lock
```

## Phase discipline

Follow the phase plan in the brief in order. Phase 1 is complete. **Do not start
Phase 2** without being asked. If a rule is not written down, it does not exist —
raise the gap rather than inventing the logic.
