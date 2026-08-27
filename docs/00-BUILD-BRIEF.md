> **⚠ This is the ORIGINAL brief, not the amended one.**
>
> The amended version — with hard rules 2 and 4 rewritten for option 4, rules 8
> and 9 added, and the second-window approach moved into the anti-patterns — was
> described in conversation but never actually arrived as a file. Sections 2.1,
> 5.2, 5.4 and 21 below are therefore STALE: they still mandate
> `SharedArrayBuffer`, COOP/COEP from day one, and a credentialless iframe.
>
> **`CLAUDE.md` in the repo root carries the current rules and wins over this
> file** until the amended brief replaces it. See `docs/spikes/` for the
> measurements behind each change.

---

# DECKS — BUILD BRIEF
### A two-deck DJ app for house parties. Personal use, MacBook Air M4.

> **How to use this file.** Put it in an empty folder, `cd` in, run `claude`, and say:
>
> *"Read DECKS_BUILD_BRIEF.md in full. Don't write any code yet. Summarise the architecture, tell me which audio source paths you're assuming, list your assumptions, and propose the Phase 1 file list and acceptance tests. Then stop."*
>
> Work one phase at a time. This document supersedes all earlier drafts.

---

## 1. WHAT THIS IS

A two-deck DJ application for playing music at parties with friends. One machine, one user, Chrome on a MacBook Air M4. Not distributed, not sold, not a product.

**The core job, stated plainly:** two songs loaded, one playing. Bring the second one in, fade the first one down, don't kill the party. Everything else is optional.

**What this is NOT:** it is not a turntablism rig. No scratching, no beat juggling, no 4 decks, no stems, no 122 effects, no controller ecosystem. Those were in earlier drafts and they are cut. Building them would triple the timeline for features you will never use at a house party.

**Prime directive:** the music never stops. A dropout at a party is worse than a missing feature. Every design decision defers to that.

---

## 2. AUDIO SOURCES — READ THIS BEFORE PLANNING ANYTHING

This section decides the architecture. Get it wrong and you build for weeks against a wall.

### 2.1 Spotify — NOT SUPPORTED. Do not attempt.

Spotify withdrew API access from all third-party DJ apps in July 2020. It returned to djay in 2025 only as a licensed commercial partnership, which is not available to a self-built app. Beyond the licensing, three hard technical blockers:

1. The Web Playback SDK is DRM-protected via EME/Widevine. You get `play`, `pause`, `seek`, `setVolume`. **You never get audio samples.** No EQ, no crossfader through Web Audio, no waveform, no analysis.
2. One Spotify account creates **one** Spotify Connect device. Two decks is structurally impossible.
3. Spotify's terms restrict the service to personal, non-commercial listening and do not permit public performance or mixing outside partnered software.

If the agent proposes a Spotify integration, a "workaround", a scraper, or a third-party unofficial library, **reject it**. Those approaches either don't work or get accounts banned.

### 2.2 Deck types

The app supports two kinds of deck. The mixer handles both, and the UI is honest about what each can do.

| | **File deck** | **YouTube deck** |
|---|---|---|
| Source | Local audio file | YouTube IFrame Player API |
| Play / pause / seek | ✅ | ✅ |
| Volume + crossfade | ✅ | ✅ (via `setVolume`) |
| EQ, filter | ✅ | ❌ |
| Waveform | ✅ | ❌ (progress bar only) |
| BPM / key / beatgrid | ✅ | ❌ |
| Sync, loops, keylock | ✅ | ❌ |
| Headphone cue | ✅ | ❌ |
| Recording the mix | ✅ | ❌ |
| Ads mid-track | — | Possible |

**Architectural consequence:** the crossfader and channel faders must not assume a `GainNode`. Define an `IDeckSource` interface with `setVolume(0..1)`, and let a file deck implement it with a `GainNode` while a YouTube deck implements it with `player.setVolume(v * 100)`. Everything above that seam is shared.

**The UI must visibly disable EQ, filter, sync and cue on a YouTube deck** — greyed out with a one-line reason on hover. Do not hide them; the DJ needs to know why the knob isn't there.

### 2.3 The tab-capture experiment (Phase 10, optional, spike first)

Chrome's `getDisplayMedia({ video: true, audio: true })` can capture a tab's audio into a `MediaStream`, which **does** route into Web Audio via `MediaStreamAudioSourceNode`. If it works, a YouTube deck gets real EQ, filter and metering. The `suppressLocalAudioPlayback: true` constraint may also make real headphone cueing possible.

**This is unverified.** Before writing any feature code, run a two-day spike answering:
1. Can two tabs be captured simultaneously in one page session?
2. Does `suppressLocalAudioPlayback` actually mute the source tab?
3. What is the added latency, and is it stable over 30 minutes?
4. Does the capture survive the tab being backgrounded?

If any answer is bad, **abandon it and keep the iframe deck**. It must never be on the critical path.

### 2.4 Where your music should actually come from

For anything you care about mixing properly, use local files. Buy them (Bandcamp, Beatport, iTunes) or use files you already own. The file deck is the real product; the YouTube deck is for requests — when someone shouts a song at 1am and you don't own it.

---

## 3. OUTPUT ROUTING — SOLVE THIS FIRST

The MacBook Air M4 has **two output channels**. Headphone cueing needs four. Without pre-listening you can't beatmatch or find the drop — you can only press play and hope.

**Step zero.** In Chrome's console:
```js
const ctx = new AudioContext();
console.log(ctx.destination.maxChannelCount, ctx.baseLatency, ctx.outputLatency);
```

| Path | Method | Cost | When |
|---|---|---|---|
| **A** | Split cue: master to the right ear, cue to the left, blend knob | £0 | **Build this first.** Always works. |
| **B** | Aggregate Device in Audio MIDI Setup: built-in + any USB-C dongle | ~£10 | If it reports 4 channels, route master→1/2, cue→3/4. Test 30 min continuous — drift correction can click. |
| **C** | Class-compliant 4-out USB interface | £70–100 | If you keep at it |

**Never create a second `AudioContext` for the cue.** Two contexts, two clocks, guaranteed drift. One context, `destination.channelCount = maxChannelCount`, `ChannelMergerNode` to route.

---

## 4. STACK

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript (strict) + Vite |
| Styling | Tailwind + CSS custom properties |
| State | Zustand — audio state never flows through React |
| Audio | Web Audio API + `AudioWorkletProcessor` |
| Keylock | `signalsmith-stretch` (WASM/AudioWorklet, MIT) |
| Waveforms | WebGL2 |
| Analysis | `essentia.js` in a Web Worker |
| Storage | IndexedDB (Dexie) + File System Access API |
| YouTube | IFrame Player API |
| Shell | Chrome installed PWA |

**No Python sidecar.** Earlier drafts had one for Demucs stem separation; stems are cut, and `essentia.js` in a worker is fast enough for BPM and key at this scope. One less moving part to start before a party.

---

## 5. HARD RULES

1. **No `AudioBufferSourceNode` for file decks.** Use a custom `AudioWorkletProcessor`. `AudioBufferSourceNode` can't do sample-accurate looping or clean cue jumps.
2. **No audio state in React state.** One rAF loop reads a `SharedArrayBuffer` and updates a UI mirror. Never `postMessage` per audio frame.
3. **No allocations or `console.log` inside `process()`.** Pre-allocate everything at construction.
4. **COOP/COEP headers from day one** — `SharedArrayBuffer` needs them. Set them in `vite.config.ts` immediately.
5. **Deck sources sit behind `IDeckSource`.** The mixer never knows whether it's driving a gain node or a YouTube player.
6. **The music never stops.** Any error, any failed load, any exception — the currently playing deck keeps playing. Errors surface as a banner, never a modal, never a blocked UI.
7. **Every DSP module gets a unit test** against reference vectors: silence in → silence out, sine in → expected magnitude.

---

## 6. ARCHITECTURE

```
src/
├─ engine/
│  ├─ IDeckSource.ts             # play/pause/seek/setVolume/getPosition
│  ├─ FileDeck.ts                # worklet-backed, full features
│  ├─ YouTubeDeck.ts             # IFrame API wrapper
│  ├─ graph.ts                   # mixer wiring, channel routing
│  ├─ worklets/
│  │  ├─ deck-processor.js       # sample player: rate, loop, cue
│  │  ├─ eq-isolator-processor.js
│  │  ├─ filter-processor.js
│  │  ├─ limiter-processor.js
│  │  └─ meter-processor.js      # writes to SAB, never postMessage
│  ├─ dsp/  (linkwitz-riley.ts · svf.ts · interpolate.ts · stretch.ts)
│  ├─ sync/ (Beatgrid.ts · SyncEngine.ts · Clock.ts)
│  └─ shared/sab-layout.ts       # document the memory map
├─ analysis/
│  ├─ analyzer.worker.ts         # essentia.js: BPM, beats, key
│  └─ peaks.ts                   # multi-resolution 3-band peaks
├─ library/  (db.ts · scanner.ts · tags.ts · camelot.ts)
├─ ui/
│  ├─ tokens.css                 # the whole design system
│  ├─ gallery/                   # /dev/gallery — every control, every state
│  └─ deck/ · mixer/ · browser/ · party/
└─ store/
```

### 6.1 Audio graph (file decks)

```
DeckWorklet
  ├─ Trim
  ├─ EQ Isolator (3-band Linkwitz-Riley @ 300 Hz / 3 kHz)
  ├─ Filter (state-variable, single-knob LP/HP)
  ├─ Channel fader
  ├─ Crossfader assign
  ├─ VU tap ──► meter-processor ──► SAB
  ├─ Cue send (pre-fader) ──────► Cue Bus
  └─ ────────────────────────────► Master Bus
                                      ├─ Limiter (5 ms lookahead, soft knee)
                                      ├─ Recorder tap
                                      └─ ChannelMerger → ch 1/2

Cue Bus → cue/master blend + split cue → ChannelMerger → ch 3/4
```

YouTube decks bypass this entirely — they play through their own iframe, and the crossfader drives `setVolume` on them. Their audio is not in the master bus, so it is **not recorded and not limited**. Say so in the UI.

---

## 7. THE FILE DECK PROCESSOR

### 7.1 State
- `playhead` — **float64 sample position**. Never float32; precision dies past ~16M samples.
- `rate` — signed float
- PCM via `SharedArrayBuffer` (`Float32Array` per channel), written once
- Loop: `loopIn`, `loopOut`, `loopActive`
- `cuePoint`, 4 hot cues (8 is turntablist territory; 4 is plenty here)

### 7.2 Interpolation
4-point cubic Hermite. **Never linear** — it aliases audibly on pitch changes. Windowed-sinc is unnecessary at the ±8% you'll actually use.

### 7.3 Keylock
Route through the Signalsmith Stretch worklet, stretch ratio `1/rate`, pitch shift 0. Crossfade over 20 ms when toggling so it doesn't click. Auto-bypass above roughly ±30% rate.

### 7.4 Loops
Auto-loop 1, 2, 4, 8, 16, 32 beats. Halve and double. Manual in/out. Boundaries snap to the grid when quantize is on.

**Loop wrap must be sample-exact.** Test: a 1-beat loop on a sine tone must produce a continuous sine, verified by FFT showing no broadband click.

### 7.5 Not building
Scratching, jog physics, slip mode, reverse, backspin, censor. Party mixing doesn't use them and each one is days of work.

---

## 8. BEATGRID AND SYNC

```ts
interface Beatgrid {
  bpm: number;
  beats: Float64Array;      // beat positions in SECONDS — supports variable tempo
  downbeatIndex: number;
  confidence: number;
  locked: boolean;          // user-verified, don't re-analyse
}
```

Store the **beat array**, not BPM + offset — it handles live and organic recordings for free.

**Grid editor:** tap tempo, set downbeat (snaps to nearest onset), nudge in ms, ×2 / ÷2 BPM, metronome click over the track for verification. **Large hit targets** — grid editing in Traktor and Serato is notoriously fiddly; make yours obviously better.

**Sync engine:** tempo master (explicit or auto), beat sync (match rate, then phase-align), phase-only sync, sync lock, quantize at 1 / 1/2 / 1/4 / 1 bar. **Rate changes ramp over 5–15 ms** — instant steps click.

---

## 9. MIXER

### 9.1 EQ — a true isolator
4th-order **Linkwitz–Riley** crossover pair at 300 Hz and 3 kHz. LR4 sums flat, so at unity the three bands reconstruct the original exactly. Each band from −∞ (full kill) to +6 dB. Full bass kill is the single most useful move in party mixing — make sure it's a real kill, not a −24 dB shelf.

### 9.2 Filter
Single knob, centre-detented. Left: lowpass 20 kHz → 30 Hz. Right: highpass 30 Hz → 20 kHz. TPT state-variable filter, resonance rising toward the extremes, **log frequency mapping**.

### 9.3 Crossfader
Constant power by default: `gainA = cos(x·π/2)`, `gainB = sin(x·π/2)`. Offer a linear curve as an alternative. Per-channel assign (A / thru / B). Skip the sharp/scratch curve — you won't use it.

### 9.4 Metering and safety
Per-channel peak + RMS with correct ballistics. Master true-peak with a **latching** clip indicator that stays lit until clicked. Auto-gain on load from the analysed LUFS, so the next track doesn't arrive 6 dB louder than the last one. That single feature saves more parties than any effect.

---

## 10. EFFECTS — six, not twenty-four

Party mixing uses a handful of effects, constantly. Build these six well:

| Effect | Why |
|---|---|
| Echo / Delay (beat-synced) | Transitions, filling gaps |
| Echo-Out (freeze the tail) | Ending a track cleanly |
| Reverb | Blends, breakdowns |
| Filter Sweep | The workhorse |
| Beat Roll | Builds |
| Tape Stop | The joke everyone loves |

Each declares `{ id, name, params[], isBeatSynced, wetDryDefault }` and must be **bypass-transparent at 0% wet**. Test it.

---

## 11. LIBRARY

```ts
interface Track {
  id: string; fileHandle: FileSystemFileHandle; hash: string;
  title, artist, genre: string; durationSec: number;
  bpm: number; beatgrid: Beatgrid;
  key: string; camelot: string;
  lufs: number; gainAdjustDb: number;
  hotCues: Cue[];
  playCount: number; lastPlayed?: Date; rating: 0|1|2|3|4|5;
  analysedAt?: Date;
}
```

Playlists, full-text search, sortable columns, session history, drag to deck, and **related tracks** ranked by Camelot compatibility + BPM proximity.

**Camelot scoring:** same key 100 · ±1 on the wheel 90 · relative major/minor 90 · +7 semitones 70 · else low.

Persist directory handles in IndexedDB, re-verify with `queryPermission()` on startup, so you grant folder access once rather than every launch.

---

## 12. PARTY MODE — the feature that matters most here

A dedicated view for when you're not standing at the laptop. Big targets, few controls, hard to break.

- **One-tap transition:** loads the next queued track, syncs it, and runs an 8-bar crossfade automatically. One button.
- **Auto-DJ fallback:** if nothing is queued and the playing track is 30 seconds from the end, it picks a compatible next track and mixes it in. **The music never stops.**
- **Request queue:** search the library or paste a YouTube link, it goes in the queue.
- **Locked controls:** a toggle that disables everything except volume and skip, so a friend can take a turn without deleting your playlists.
- Everything readable from two metres away.

---

## 13. macOS / M4 NOTES

- **Chrome, not Safari.** Better `setSinkId`, better profiling, WebHID if you ever add a controller. Install as a PWA (`chrome://apps` → Install).
- `new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })`. Never `latencyHint: 0` — it causes dropouts. Display `baseLatency + outputLatency` in settings.
- **Wake lock:** `await navigator.wakeLock.request('screen')`, re-acquired on `visibilitychange`. A display that sleeps mid-party is a bug.
- **Thermals:** the M4 Air is fanless. Playback and waveforms are light; batch-analysing a large library is not. Analyse your library **before** the party, plugged in. Add a "performance mode" toggle that suspends background analysis while a deck is playing.
- **Plug in the charger before the party.** Obvious, and everyone forgets.

---

## 14. DESIGN LANGUAGE

### 14.1 Motion budget

**Animation is a performance liability until proven otherwise.** A glow that fades over 300 ms tells the DJ their button press took 300 ms. Perceived latency is the whole game.

| Class | What | Duration | Budget |
|---|---|---|---|
| **1 — Signal** | Waveform scroll, meters, beat markers. *This is the instrument.* | Continuous 60 fps | Unlimited. Protect at all costs. |
| **2 — Feedback** | Pad hit, button press, fader grab | 0–90 ms | Must feel instant |
| **3 — Transition** | Panel open, view switch | 150–320 ms | ≤ 1 ms/frame total |
| **4 — Ambient** | Idle glows, breathing gradients, particles | — | **Banned. Zero.** |

**Nothing pulses on its own timer.** One beat clock, driven by the audio master clock, written to `:root` as `--beat-phase: 0..1`. Anything that pulses reads from it.

### 14.2 The world this borrows from — the console, not the club

Reference: Urei 1620, Rane MP2015, Technics SL-1200, Neve channel strips. Anodised aluminium faceplates, screen-printed condensed uppercase legends, machined edges catching one highlight, warm incandescent lamps behind VU meters. **Cold metal, warm light.**

Serato is green-on-black, rekordbox blue-and-orange, Traktor blue. They all look like *software*. This should look like **equipment**.

### 14.3 Palette

```css
--void:     #0B0D10;   /* space behind the panels — cool, not black */
--panel:    #191D23;   /* anodised graphite faceplate */
--panel-up: #22272F;   /* raised control surface */
--legend:   #8D949C;   /* screen-printed label grey */
--lamp:     #FFB23F;   /* incandescent meter lamp — the only accent */
--hot:      #FF4438;   /* signal red */
```

Waveform bands sit outside the UI palette so they never compete:
```css
--band-low: #D97A2B;  --band-mid: #6FA88C;  --band-high: #BFD9E8;
```

- `--lamp` marks what is live and interactive. If everything is amber, nothing is.
- `--hot` appears in exactly three places: clip, record armed, destructive confirmation.
- One gradient only: a 6% white-to-transparent 1px top edge on raised surfaces, simulating a machined bevel. No mesh gradients, no glassmorphism.

**Deck identity:** a 2px machined edge down each deck panel, also tinting its playhead. Deck A copper `#C77B4A`, Deck B steel blue `#5B87A8`. Build them as tokens — you may want more saturation in a dark room.

### 14.4 Typography

Two families, self-hosted and subset. No CDN — this must work with flaky party wifi.

| Role | Face | Treatment |
|---|---|---|
| Panel legends | **Archivo Condensed** 600 | UPPERCASE, 10–11px, tracking `0.09em`. This is the silkscreen. |
| Headings, track titles | **Archivo** 400/600 | Sentence case, 13–15px |
| All numerics | **IBM Plex Mono** 500 | `font-variant-numeric: tabular-nums` — non-negotiable, proportional figures make a BPM readout jitter |

`font-display: block` on the mono face. Scale: 10 / 11 / 13 / 15 / 20 / 32 / 56, with 56 reserved for BPM.

### 14.5 Signature element — the strobe ring

Each deck has a circular position display with a **stroboscope dot ring** at the rim, like a Technics SL-1200, driven by the beatgrid:

- At native tempo: dots stationary
- Pitched up: dots drift clockwise, proportional to the offset
- Synced and phase-locked: stationary and lamp-lit
- Drifting: dots creep, and the direction tells you which way to nudge

You see your pitch is wrong before you hear it. Spend the boldness here, keep everything else quiet. **YouTube decks get a plain progress ring instead** — no strobe, because there's no grid to drive it, and a fake one would be a lie.

### 14.6 Banned outright

Neon glow and bloom · glassmorphism · particle fields · animated gradient meshes · spring-bounce on buttons · rotating record photographs · decorative equaliser bars · pulsing "LIVE" badges · drop shadows over 12px blur · border-radius over 6px on any control · brushed-metal texture JPEGs.

---

## 15. LAYOUT

8px base grid. Baseline 1440×900, must survive 1280×800.

```
┌──────────────────────────────────────────────────────────────┐
│ TRANSPORT  master clock · rec · latency · CPU · party mode   │  40px
├──────────────────────────────────────────────────────────────┤
│ SCROLLING WAVEFORMS  beat-aligned, playhead fixed at centre  │ 200px
├───────────────┬──────────────────────────┬───────────────────┤
│  DECK A       │  MIXER                   │  DECK B           │
│  strobe ring  │  trim · EQ · filter      │  strobe ring      │ 280px
│  BPM · key    │  cue · fader · VU        │  BPM · key        │
│  pitch fader  │  crossfader              │  pitch fader      │
│  cues · loops │  FX                      │  cues · loops     │
├───────────────┴──────────────────────────┴───────────────────┤
│ BROWSER  playlists │ track list │ queue │ related            │ flex
└──────────────────────────────────────────────────────────────┘
```

- Minimum hit target 32×32px. Hot cue pads 56×56px. **Party mode targets 80×80px.**
- Pitch fader minimum 220px travel.
- **Playhead fixed at horizontal centre**, audio moves past it.

---

## 16. MOTION TOKENS AND MICRO-INTERACTIONS

```css
--t-none: 0ms;
--t-tap:  70ms;   --e-tap:  cubic-bezier(0.2, 0, 0, 1);   /* decelerate only */
--t-ui:   180ms;  --e-ui:   cubic-bezier(0.32, 0.72, 0, 1);
--t-slow: 320ms;  --e-slow: cubic-bezier(0.16, 1, 0.3, 1);
```

**Never `ease-in` or `ease-in-out` on feedback** — anything that ramps up reads as lag. **Only animate `transform` and `opacity`.**

| Element | Behaviour |
|---|---|
| **Hot cue pad** | Fill jumps to full instantly (0 ms), decays over 140 ms exponentially — an LED discharging. No scale, no bounce. |
| **Play / pause** | State flips instantly. The strobe ring carries the motion, ramping over the same duration as the audio's rate ramp. |
| **Fader / crossfader** | 1:1 with the cursor. Zero easing, ever. Smoothing on a fader is a lie about where the audio is. |
| **Knob** | Only the indicator line rotates. Value readout on grab, fades after 800 ms. Shift-drag = 1/8 sensitivity. |
| **Loop active** | Loop region fills 12% lamp, static. The loop *button* pulses once per cycle, on the beat clock. |
| **One-tap transition** | The crossfader travels visibly across the full 8 bars, so you can see the mix happening and grab it manually at any point. |
| **Track load** | Waveform wipes left-to-right over 240 ms. Grey RMS on decode, colour washes in as analysis returns. Never a spinner over the waveform. |
| **Clip indicator** | Latches `--hot` and stays latched until clicked. Never auto-fades. |
| **YouTube deck** | Disabled controls sit at 30% opacity with a hover reason. Never hidden. |
| **Keyboard focus** | 2px `--lamp` outline, 2px offset. Never `outline: none`. |

---

## 17. UI PERFORMANCE ARCHITECTURE

1. **One `requestAnimationFrame` loop for the entire app.** Not one per deck. It reads the SAB and drives everything.
2. **All signal motion in one WebGL2 canvas.** Scroll by updating a uniform, never by regenerating geometry.
3. **React must not re-render on playhead updates.** Numeric readouts written via refs to `textContent`. Renders during playback in the React profiler are a defect.
4. **`will-change` on at most three elements at a time.**
5. **`/dev/gallery` route** rendering every control in every state with no audio engine loaded. Design there, not in the running app.

---

## 18. ACCESSIBILITY AND ROOM READABILITY

- **Never convey state by colour alone.** A green "synced" dot and a red one are identical to a meaningful fraction of people. Every state also gets a shape, label or position change.
- **Contrast ≥ 4.5:1** for all text, verified with a checker.
- **`prefers-reduced-motion`** disables classes 3 and 4. It never disables the waveform, meters or strobe ring — those are the instrument.
- Full keyboard operation with a cheat-sheet overlay. Space, arrow keys and 1–8 should cover a whole set.
- Test at 50% screen brightness from two metres. That's the party.

---

## 19. COPY

- **Name things by what you control.** "Beatgrid", "Hot cue", "Keylock".
- **A control says what happens.** Button says "Analyse", toast says "Analysed".
- **Errors state what happened and what to do.** "YouTube deck can't use EQ — the audio isn't available to the mixer" beats a greyed-out knob with no explanation.
- **Empty states invite action.** "Add a music folder to get started", with the button right there.
- Sentence case everywhere except panel legends, which are uppercase because they're silkscreen.

---

## 20. PHASE PLAN

Write the acceptance tests first. Don't move on until they pass.

### Phase 1 — One deck, sound out · ~4 days
Scaffold, COOP/COEP, `IDeckSource`, one file deck worklet playing at variable rate, master out, transport. `tokens.css`, fonts, `/dev/gallery`, PWA manifest, latency readout.

**Accept:** load a file, play/pause/cue, rate ±8% with no clicks, `outputLatency` under 25 ms, 10 minutes of playback with zero xruns.

### Phase 2 — Two decks and the mixer · ~1 week
Second deck, LR4 EQ isolator, filter, channel faders, crossfader, **split cue (Path A)**, meters via SAB, master limiter, auto-gain from LUFS.

**Accept:** at unity all three EQ bands sum flat within ±0.1 dB (sweep + FFT); full kill on all three = silence; constant-power crossfader at centre = −3 dB per side; cue audible in one ear while master plays the other. **At this point the app already does the core job.**

### Phase 3 — Analysis and waveforms · ~1 week
`essentia.js` worker (BPM, beats, key, peaks, LUFS), IndexedDB cache, WebGL waveforms, beatgrid editor. **The single rAF loop and beat clock land here.**

**Accept:** BPM correct within ±0.05 on 20 test tracks; beat markers land on transients; two waveforms scroll at 60 fps; re-import of an analysed track is instant.

> **Note the ordering.** Analysis comes before loops and sync because both are built on beat positions. Building them against a placeholder BPM means rewriting them.

### Phase 4 — Mixing features · ~1 week
Hot cues, loops, sync engine, quantize, keylock, strobe ring.

**Accept:** a 1-beat loop on a 1 kHz sine gives a continuous sine, no broadband click on FFT; two tracks at 124 and 128 BPM stay phase-locked for 5 minutes.

### Phase 5 — Library · ~4 days
Playlists, search, Camelot wheel, related tracks, queue, session history, recording to WAV.

**Accept:** a 2000-track library scans and lists with no UI jank.

### Phase 6 — YouTube deck · ~3 days
IFrame API wrapper implementing `IDeckSource`, search or paste-link, crossfade via `setVolume`, honest disabled controls.

**Accept:** two YouTube videos crossfade smoothly; disabled controls explain themselves; a YouTube deck never breaks the file decks.

### Phase 7 — Party mode · ~4 days
One-tap transition, auto-DJ fallback, request queue, locked controls, large-target view.

**Accept:** auto-DJ runs 60 minutes unattended with no silence and no dropouts. **This is the test that matters most.**

### Phase 8 — Effects · ~4 days
The six, beat-synced.

**Accept:** every effect is bypass-transparent at 0% wet; beat-synced effects stay locked through a tempo change.

### Phase 9 — Polish · ~3 days
4-channel routing (Path B/C) if you buy hardware. Reduced-motion pass, contrast audit, keyboard pass, 1280×800 check, performance mode.

### Phase 10 — Tab-capture spike · optional
Only as described in §2.3, and only after everything above works.

**Realistic total: 5–7 weeks of evenings.** You have something genuinely usable after Phase 2 — about ten days in.

---

## 21. ANTI-PATTERNS

- ❌ Any attempt at Spotify integration, official or otherwise
- ❌ Downloading or ripping audio from YouTube
- ❌ `<audio>` elements or `AudioBufferSourceNode` for file decks
- ❌ `ScriptProcessorNode`
- ❌ `postMessage` per audio frame, or allocations in `process()`
- ❌ Playhead stored as float32
- ❌ Two `AudioContext`s for master and cue
- ❌ React re-rendering on playhead updates
- ❌ Multiple `requestAnimationFrame` loops
- ❌ Anything pulsing on a wall-clock timer instead of the beat clock
- ❌ Pretending a YouTube deck has features it doesn't
- ❌ Modal dialogs during playback
- ❌ Adding a feature before the previous phase's tests pass

---

## 22. THE CUT LIST

If you want it working for a party in two weeks, build only this:

1. Two file decks — play, cue, pitch
2. EQ, filter, crossfader, auto-gain
3. Split-cue monitoring
4. Waveforms and BPM
5. Sync and one-tap transition
6. A flat track list with search

Everything else is optional. **Do not build features you haven't yet wanted while playing.**

---

## 23. INSTRUCTION TO THE AGENT

Before writing any code:

1. Restate the architecture in your own words and name the three things most likely to go wrong.
2. State which output path (§3) you're assuming and what happens if `maxChannelCount` is 2.
3. Confirm you understand why Spotify is excluded and that you will not propose a workaround.
4. Explain how `IDeckSource` keeps the mixer agnostic between file and YouTube decks.
5. Produce the Phase 1 file list, one line per file, including `tokens.css`, the PWA manifest and the latency readout.
6. Write the Phase 1 acceptance tests **before** the implementation.
7. Stop and wait.

Then build Phase 1 only.

After each phase, open the Chrome Performance panel with both decks playing and report main-thread ms/frame, GPU ms/frame, and whether any React re-render fires during playback. If the motion budget in §14.1 is exceeded, cut animation — never waveform frame rate.
