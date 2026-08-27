import { useCallback } from 'react'
import { Readout } from '../controls/Readout.js'
import { frameCount } from '../frame/frameLoop.js'
import { LatencyReadout } from './LatencyReadout.js'

/** The 40px strip across the top (§15). Master clock, latency, frame counter. */
export function TransportBar({ ctx }: { ctx: AudioContext | null }) {
  const readClock = useCallback(() => (ctx ? ctx.currentTime.toFixed(1) : '0.0'), [ctx])
  const readFps = useCallback(() => String(frameCount()), [])

  return (
    <header
      className="panel"
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '0 var(--space-2)',
        borderBottom: '1px solid var(--hairline)',
      }}
    >
      <span className="legend" style={{ color: 'var(--lamp)', letterSpacing: '0.18em' }}>
        Decks
      </span>
      <Readout read={readClock} label="Master clock" size={13} />
      <Readout read={readFps} label="Frames" size={13} />
      <div style={{ flex: 1 }} />
      <LatencyReadout />
    </header>
  )
}
