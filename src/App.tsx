import { useEffect, useState } from 'react'
import { resumeOnGesture, totalLatencyMs } from './engine/context.js'
import { onError } from './engine/errors.js'
import type { FileDeck } from './engine/FileDeck.js'
import { getSession } from './engine/session.js'
import { startWakeLock } from './pwa/wakeLock.js'
import { DeckPanel } from './ui/deck/DeckPanel.js'
import { ErrorBanner } from './ui/ErrorBanner.js'
import { subscribeFrame, writeBeatPhase } from './ui/frame/frameLoop.js'
import { GalleryRoute } from './ui/gallery/GalleryRoute.js'
import { TransportBar } from './ui/transport/TransportBar.js'
import { useUiStore } from './store/uiStore.js'
import { renderCounts, resetRenderCounts } from './ui/renderCount.js'

export function App() {
  if (location.pathname.startsWith('/dev/gallery')) return <GalleryRoute />
  return <DecksApp />
}

function DecksApp() {
  const [deckA, setDeckA] = useState<FileDeck | null>(null)
  const [ctx, setCtx] = useState<AudioContext | null>(null)
  const setEnvironment = useUiStore((s) => s.setEnvironment)
  const setDeck = useUiStore((s) => s.setDeck)
  const pushBanner = useUiStore((s) => s.pushBanner)

  useEffect(() => onError(pushBanner), [pushBanner])
  useEffect(() => startWakeLock(), [])

  // The session is memoised, so StrictMode's second mount reuses it rather than
  // building a second deck. Nothing is disposed on unmount: the engine outlives
  // the component tree by design.
  useEffect(() => {
    void getSession().then((s) => {
      setCtx(s.ctx)
      setDeckA(s.deckA)
    })
  }, [])

  // Latency is only meaningful once the context is running, and outputLatency
  // reads 0 until then.
  useEffect(() => {
    if (!ctx) return
    const publish = () => setEnvironment(totalLatencyMs(ctx), ctx.destination.maxChannelCount)
    publish()
    const id = window.setInterval(publish, 1000)
    return () => window.clearInterval(id)
  }, [ctx, setEnvironment])

  // Keep the store's deck state in step without polling it at frame rate.
  useEffect(() => {
    if (!deckA) return
    const id = window.setInterval(() => {
      setDeck('A', { state: deckA.state, title: deckA.title, durationSec: deckA.durationSec })
    }, 250)
    return () => window.clearInterval(id)
  }, [deckA, setDeck])

  // The beat clock is written here, by the one loop, from the audio clock.
  // Phase 3 gives it a beatgrid to read; until then it stays at 0 rather than
  // inventing a tempo.
  useEffect(() => subscribeFrame(() => writeBeatPhase(0)), [])

  // Test surface for the acceptance tests. Reading it has no side effects.
  useEffect(() => {
    ;(window as any).__decks = {
      renderCounts,
      resetRenderCounts,
      deckA: () => deckA,
      ctx: () => ctx,
      positionSec: () => deckA?.getPositionSec() ?? 0,
      xruns: () => deckA?.xruns ?? 0,
      driftSamples: () => deckA?.driftSamples ?? 0,
      latencyMs: () => (ctx ? totalLatencyMs(ctx) : 0),
      baseLatencyMs: () => (ctx ? ctx.baseLatency * 1000 : 0),
      outputLatencyMs: () => (ctx ? (ctx.outputLatency || 0) * 1000 : 0),
    }
  }, [ctx, deckA])

  return (
    <div
      style={{ display: 'grid', gridTemplateRows: '40px 1fr', height: '100%' }}
      onPointerDown={() => void (ctx && resumeOnGesture(ctx))}
    >
      <TransportBar ctx={ctx} />
      <main style={{ padding: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <DeckPanel id="A" deck={deckA} />
      </main>
      <ErrorBanner />
    </div>
  )
}
