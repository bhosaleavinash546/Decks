# Spike: cross-origin isolation vs. a third-party iframe

**Question.** DECKS needs `SharedArrayBuffer`, which needs cross-origin isolation, which needs
COOP/COEP. YouTube sends no COEP headers. Under the isolation config Phase 1 puts in
`vite.config.ts`, does a third-party iframe still load and stay drivable by `postMessage`?
If not, the Phase 6 YouTube deck is dead.

**Method.** Two local origins. `127.0.0.1:8801` plays the app and varies its isolation headers
per case. `127.0.0.1:8802` plays the third party with exactly YouTube's header posture — no
COEP, no CORP, no `X-Frame-Options` — and speaks the same `postMessage` handshake the IFrame
Player API uses. Each case asserts four things: `crossOriginIsolated`, that a
`SharedArrayBuffer` actually constructs, that the child frame handshakes outbound, and that a
command posted *into* the frame is acknowledged (the direction the Player API drives).

Run it with `./run.sh`. Chromium 141.0.7390.37.

## Result

| Case | Isolated | SAB | Iframe | Command | |
|---|---|---|---|---|---|
| No isolation headers (control) | no | undefined | live | ack | iframe fine, no SAB |
| COOP + COEP `require-corp`, plain iframe | yes | constructed | **dead** | — | frame blocked |
| COOP + COEP `credentialless`, plain iframe | yes | constructed | **dead** | — | **frame blocked** |
| COOP + COEP `credentialless`, `<iframe credentialless>` | yes | constructed | live | ack | **works** |
| `Document-Isolation-Policy: isolate-and-credentialless` | **no** | undefined | live | ack | no isolation |

## What this means

**The plan's assumption was wrong.** `COEP: credentialless` on its own does *not* rescue the
embed. The header relaxes how *subresources* are fetched; a nested cross-origin *document*
must still opt into isolation, and YouTube never will. Row 3 is the config we were going to
ship, and it kills the YouTube deck silently — nothing throws, the frame just renders an error
page and never handshakes.

**The fix is the `credentialless` attribute on the iframe element**, which is a different
mechanism with a confusingly similar name. It loads the frame in an ephemeral, cookie-less
context, and that is enough for the embedder to stay isolated. Both `postMessage` directions
survive, so the full IFrame Player API control channel works.

The third-party server logged a hit in every case including the blocked ones — the request is
made and the *response* is rejected, which is why this fails invisibly rather than loudly.

**`Document-Isolation-Policy` is not an option yet.** It is designed for exactly this problem
and would remove the need for the attribute, but in Chromium 141 it does not grant isolation,
with or without `--enable-features=DocumentIsolationPolicy`. Worth retesting later; if it lands
it simplifies this.

## Consequence to accept

A `credentialless` iframe has no access to YouTube cookies. The YouTube deck is therefore
permanently signed out: no personalisation, no history, and age-restricted or sign-in-gated
videos will refuse to play. For a request deck at 1am that is an acceptable trade, but it is a
real limitation and the UI should say so rather than let a failed load look like a bug.

## Not covered here

This proves the *browser policy* half. It does not prove YouTube's own behaviour, because
youtube.com is blocked by this container's network policy. Re-run `./run.sh` on the MacBook
against a real embed URL before Phase 6 starts, to confirm the player tolerates a cookie-less
context and to see what ad behaviour looks like signed out.
