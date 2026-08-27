# DECKS

A two-deck DJ application for house parties. Chrome on a MacBook Air M4.

## Running it

```bash
npm install
npm run fonts    # once — self-hosts Archivo and IBM Plex Mono
npm run dev      # http://127.0.0.1:5173
```

Load an audio file into deck A, press Play. The transport stays disabled until
the file has finished decoding, and says so on hover.

`/dev/gallery` renders every control in every state with no audio engine loaded.
Design there, not in the running app.

### Installing it as a PWA

Chrome → the install icon in the address bar, or `chrome://apps`. Plug the
charger in before the party.

## Testing it

```bash
npm test          # 40 unit tests, ~1s
npm run test:e2e  # acceptance tests in a real browser, ~20s
npm run soak      # the ten-minute soak, on its own
npm run lint      # eslint + tsc --noEmit
```

Audio fixtures are generated on demand by `scripts/make-fixtures.mjs` — a minute
of 48 kHz stereo is 11 MB, so they are not committed.

To run the soak for less than ten minutes while iterating:

```bash
SOAK_MINUTES=2 npm run soak
```

## Architecture in one paragraph

One `AudioContext`. A file deck is an `AudioWorkletProcessor` that receives its
PCM as a transferred `ArrayBuffer` and owns a float64 playhead. The main thread
never reads that playhead per frame — it *derives* it by integrating the same
rate curve against the audio clock, read through `getOutputTimestamp()` so the
displayed position matches what is audible rather than what was last rendered.
The worklet reports its true position once a second so a dropped render quantum
can be corrected. One `requestAnimationFrame` loop for the whole app reads the
engine and writes to `textContent` via refs; React does not re-render during
playback. There is no `SharedArrayBuffer` and no cross-origin isolation — see
`docs/spikes/` for why that decision was measured rather than assumed.

## Phase 1 scope

One deck, sound out. Load, play, pause, cue, rate ±8%, latency readout, xrun
counter, design tokens, `/dev/gallery`, PWA manifest, wake lock.

Not yet: a second deck, EQ, filter, crossfader, cue bus, waveforms, analysis,
loops, sync, library, YouTube deck, effects, party mode.
