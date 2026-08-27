// One engine per page, created once.
//
// React 18 StrictMode mounts effects twice in development. Creating the mixer
// inside an effect therefore built two decks, disposed one, and left the button
// and the test surface holding different objects — which looked exactly like a
// transport bug. The engine outlives every component, so it is memoised here and
// never torn down by a render.

import { createEnvironment } from './context.js'
import type { FileDeck } from './FileDeck.js'
import { createMixer, type Mixer } from './graph.js'

export interface Session {
  readonly ctx: AudioContext
  readonly mixer: Mixer
  readonly deckA: FileDeck
}

let session: Promise<Session> | null = null

export function getSession(): Promise<Session> {
  session ??= (async () => {
    const { ctx } = createEnvironment()
    const mixer = createMixer(ctx)
    const deckA = await mixer.createFileDeck('A')
    return { ctx, mixer, deckA }
  })()
  return session
}
