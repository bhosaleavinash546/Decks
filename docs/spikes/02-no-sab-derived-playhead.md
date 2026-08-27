# Spike: option 4 — drop cross-origin isolation, no SharedArrayBuffer

**Question.** The approved plan needs `SharedArrayBuffer`, which needs cross-origin isolation,
which forces every third-party iframe into a credentialless (signed-out) context — which means
ads mid-track on a Premium account. Option 4 asks whether SAB is load-bearing at all: PCM
transferred once at load, playhead derived on the main thread from the audio clock, meters from an
`AnalyserNode`. If it holds, `vite.config.ts` drops COOP/COEP and the YouTube embed can be signed in.

**Method.** A worklet deck with no SAB anywhere, served from a page with no isolation headers
(the spike asserts `crossOriginIsolated: false` and `SharedArrayBuffer: undefined`, so it cannot
be accidentally passing). PCM handed over with `port.postMessage(buf, [buf])` — the main thread's
view is detached afterwards, asserted. Playback starts on a scheduled sample, and the worklet
reports its true playhead once per second **only so the spike can measure the error**.

Rate changes every 20 s cycling 1.00 / 1.08 / 0.92 / 1.04 / 0.96 with 10 ms ramps — 30 changes
over the run. Run with `./run.sh` (`SEC=45 ./run.sh` for a quick check). Chromium 141, 48 kHz.

> Never pass `--virtual-time-budget`: it warps the audio clock. An early version of this spike
> reported the context clock advancing 0.02 s per wall second because of it.

## Result — 600 s, 30 rate changes

| | |
|---|---|
| `crossOriginIsolated` / SAB available | **false / false** |
| PCM transferred (main copy detached) | true |
| **Derived playhead error, max** | **0.041 samples — 0.001 ms** |
| Derived playhead error, final | 0.019 samples |
| Same formula ignoring the ramp integral | 19.161 samples — 0.399 ms |
| rAF frames / fps | 35 949 / 59.9 |
| Read jitter, `ctx.currentTime` | 242.5 samples sd |
| Read jitter, `getOutputTimestamp()` | **90.7 samples sd** |
| Render clock ahead of audible | **1719.7 samples — 35.8 ms** |
| Full-scale impulses emitted / caught by AnalyserNode | **119 / 119** |

## 1. Does the derived playhead stay accurate over 10 minutes?

**Yes — 0.041 samples of error at worst, which is float64 rounding and nothing else.** There is no
drift to measure. That is not luck: `ctx.currentTime` *is* the audio clock the worklet advances on,
so the two cannot diverge. The formula is not an approximation of the playhead, it is the same
quantity computed twice.

Two things have to be right for that to hold, and both are easy to get wrong:

**Model the ramp, not the step.** Treating each rate change as instantaneous costs 19.16 samples
(0.4 ms) per ramp — `Δrate × rampSec / 2`. In this run those errors happened to cancel, because the
test cycles rates symmetrically and returns to 1.0. They would **not** cancel under a sync engine
making repeated same-direction corrections, which is exactly the Phase 4 workload. Both sides must
integrate the same curve, and the rate change must be scheduled at an agreed frame rather than
applied when the message happens to arrive.

**Anchor on the first produced sample.** My first two attempts read 202 and then 138 samples of
error, both from anchor bugs rather than the concept — the worklet started on the quantum boundary
containing the scheduled start rather than the sample itself, and then reported a playhead that had
already advanced through the quantum against a timestamp from the quantum's start. Worth stating
plainly because both are the kind of off-by-a-quantum mistake the real deck will make once.

One caveat that survives: **a derived clock assumes the worklet never misses a render quantum.**
If the audio thread drops one, the playhead advances less than the formula predicts while the
context clock keeps going, and the derived position is permanently ahead — silently. Keep the 1 Hz
truth report and re-anchor on it. It is an event-rate message, it costs nothing, and it doubles as
the xrun detector.

## 2. Any audible or visual regression versus the SAB design?

**No — and on the one metric that matters visually it is better.**

**Metering is not a downgrade.** 119 full-scale single-sample impulses emitted, 119 caught. At 60 fps
an `AnalyserNode` with `fftSize: 2048` hands back 42.7 ms of history every 16.7 ms, so consecutive
reads overlap and there are no gaps to miss a peak in. A latching clip indicator (§9.4) works.

**The derived playhead is more accurate than the SAB one, not less.** This is the surprise.
`ctx.currentTime` and a SAB playhead both describe the frame just *rendered*, which is 35.8 ms ahead
of what is coming out of the speakers. `getOutputTimestamp()` reports the frame being *heard*, and
interpolating it against `performance.now()` puts the playhead where the sound actually is. At
128 BPM, 35.8 ms is 7.6% of a beat — visible on a strobe ring, and visible as a waveform whose
playhead sits slightly ahead of the transient you can hear. The SAB design has this error too and
has no comfortable way to correct it.

Interpolating also reads smoother: 90.7 samples of step jitter against 242.5 for raw
`ctx.currentTime`, because the raw clock is quantised to the 128-sample render quantum while the
timestamp pair can be interpolated between updates.

**Recommendation for the rAF loop: derive from `getOutputTimestamp()`, fall back to
`ctx.currentTime` where it is unavailable.**
## 3. What in the brief genuinely needs SharedArrayBuffer

Going through everything the SAB was carrying in the approved plan:

| Job SAB was doing | Without SAB | Verdict |
|---|---|---|
| Playhead to the UI | Derived from the audio clock | **Better** — see §2, it can be made latency-correct |
| PCM into the worklet | One transferred `ArrayBuffer` at load | **Better** — transfer moves, so the buffer is resident once, not twice |
| Meters | `AnalyserNode` on the main thread | Equal — every impulse caught, see §1 |
| xrun counting | The 1 Hz truth report already carries it | Equal |
| Waveform peaks | Computed at load *before* the transfer, kept on the main thread | Equal — `peaks.ts` did this anyway |
| Analysis worker input | A copy posted to the worker before the transfer | Equal, one extra copy at load |
| **Recorder tap (Phase 5)** | Worklet posts a pre-allocated buffer from a pool every ~1 s | **Mildly worse** — the one real loss |

**Nothing in the brief requires SAB.** The recorder is the only place it was doing work with no
equal substitute, and the substitute is fine: pre-allocate a pool of buffers at construction and
post one every second as a transferable. That keeps `process()` allocation-free, which is what
hard rule 3 actually cares about, and it is Phase 5 rather than Phase 1.

Two things worth naming rather than glossing:

**The memory story improves.** A SAB has to be allocated as shared up front and the PCM copied
into it from the decoded `AudioBuffer`, and the main thread keeps its view alive. A transfer is a
move: after the handoff the main thread's copy is detached (the spike asserts
`pcmDetached: true`). Same one copy at load, one fewer resident afterwards.

**Zero messaging is not quite the right target.** A derived clock assumes the worklet never
misses a render quantum. If the audio thread does drop one, its playhead advances less than the
formula predicts while the context clock keeps going, and the derived position is permanently
ahead by the dropped amount — silently. So the deck should keep the 1 Hz truth report and
re-anchor on it. That is an event-rate message, not a per-frame one, it costs nothing, and it
doubles as the xrun detector. Design for one message a second, not for none.

### On the hard-rule conflict

Hard rule 3 bans allocations in `process()`, and you are right that `postMessage` from a worklet
allocates. To be accurate though, this was not a conflict in the approved plan: that design wrote
the playhead into a SAB view from `process()` and never called `postMessage` there at all, which
is what the brief's rule 2 asks for. Both designs are allocation-free at steady state. Option 4
wins on other grounds, not this one.

What does need saying: **option 4 contradicts hard rules 2 and 4 as written** ("one rAF loop reads
a SharedArrayBuffer", "COOP/COEP headers from day one"). Those rules should be rewritten in the
brief as part of taking this option, or a future session will read them, notice the code disagrees,
and "fix" the architecture back.

## 4. Recommendation: option 4, and option 2 is not the fallback you think

**Take option 4.**

The measurements say it costs nothing. Question 1 comes back exact and question 2 comes back
better-than-parity, so the only thing SAB was still buying was conformance to two rules in a brief
we are amending anyway.

But the more important finding is about **option 2**, and it changes the shape of the decision.

Option 2 was "put the YouTube player in a separate, non-isolated window so the main app can stay
isolated". That window would host *our* page, which embeds the YouTube iframe — so the player is
still in a **third-party context**, exactly as it is under option 4. Being in its own window does
not make it first-party; only navigating that window to youtube.com itself would, and the IFrame
Player API cannot drive a window we do not own.

**So option 2 does not solve the ads problem at all.** Whatever the signed-in state of the embed
is under option 4, it is identical under option 2. Option 2 costs a second window, a user gesture
to open it, and a whole failure mode where someone closes it mid-set — and buys nothing on the
question that prompted it. It should come off the table.

### The thing dropping COOP/COEP does not settle

Cross-origin isolation is one of two gates on a signed-in embed. The other is **third-party cookie
policy**, because an embedded player is third-party no matter which option we pick. If Chrome
blocks third-party cookies for youtube.com, the embed is signed out and you get ads whatever we do.

I probed this locally (`cookie-probe.mjs`, two loopback hostnames because cookies ignore port) and
this Chromium sends third-party cookies with `SameSite=None; Secure` by default, with the Storage
Access API available as a fallback. That is a directional signal, not proof about YouTube.

**The 60-second test only you can run**, before Phase 6 is planned around it: open a page
containing a plain `<iframe src="https://www.youtube.com/embed/VIDEO_ID">` served from localhost,
in your normal Chrome profile with Premium signed in, and watch whether you get a pre-roll.

### If that test fails

The fallback is **not** option 2. It is the tab-capture route the brief already contemplates in
§2.3 — capture a real youtube.com tab where you are genuinely first-party and signed in. That path
would also hand the YouTube deck real EQ, filter and metering, which the iframe deck can never
have. It stays a Phase 10 spike and off the critical path; it just becomes the answer to a
different question than the brief expected.

## Caveats on these numbers

**The xrun counter fired without the position ever moving.** The worklet's `currentFrame`
discontinuity detector counted 8 over 600 s and 3 over 120 s — and, importantly, not only at
startup (1 before the first second, 2 after). Yet the derived position never diverged by more than
0.04 samples across either run. A genuinely dropped quantum would have shown as a ~128-sample step,
so these are either detector artefacts or Chrome catching up without losing frames. I could not
resolve which, and it is a property of my probe rather than of option 4. Either way it is the
argument for keeping the 1 Hz truth report: it makes the question stop mattering.

**The latency figures are not your machine's.** This container reports `baseLatency` 10.02 ms and
`outputLatency` 32.00 ms against a headless null audio sink on Linux. That is not a MacBook Air M4
with a real output device, and the 32 ms would fail the Phase 1 gate of `outputLatency < 25 ms` if
it were real. Nothing here can tell you what your machine will report — that number has to come
from `./run.sh` on the Mac, or from the Phase 1 latency readout.

**Headless is not a party.** 59.9 fps sustained with no display compositing, no WebGL waveform, no
second deck and no thermal ceiling. This spike says the *clock* is sound; it says nothing about
whether the M4 holds 60 fps with two decks and waveforms running, which is what Phase 3 has to
prove.
