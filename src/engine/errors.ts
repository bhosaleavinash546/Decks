// HARD RULE: the music never stops.
//
// Every failure funnels through here and becomes a banner. Never a modal, never
// a blocked UI, and never anything that touches a deck that is currently
// playing (§5.6).

export interface DeckError {
  readonly id: number
  readonly message: string
  readonly detail?: string
  readonly at: number
}

type Listener = (e: DeckError) => void

let nextId = 1
const listeners = new Set<Listener>()

export function onError(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Report a failure without letting it propagate. Returns the error so callers
 * can log it; it deliberately never rethrows.
 */
export function reportError(message: string, cause?: unknown): DeckError {
  const detail = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
  const e: DeckError = { id: nextId++, message, detail, at: Date.now() }
  for (const fn of listeners) {
    try {
      fn(e)
    } catch {
      // A failing error listener must not take down the caller.
    }
  }
  return e
}

/** Run `fn`, turning any throw into a banner. Playback is never interrupted. */
export function guard<T>(message: string, fn: () => T): T | undefined {
  try {
    return fn()
  } catch (cause) {
    reportError(message, cause)
    return undefined
  }
}

/** Async form of `guard`. */
export async function guardAsync<T>(message: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (cause) {
    reportError(message, cause)
    return undefined
  }
}
