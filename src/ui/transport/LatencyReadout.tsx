import { useUiStore } from '../../store/uiStore.js'

/**
 * baseLatency + outputLatency (§13). The Phase 1 gate is under 25 ms, so the
 * number turns amber above it rather than quietly sitting there being bad.
 *
 * State, not colour alone: over budget also gets a marker (§18).
 */
export function LatencyReadout() {
  const latencyMs = useUiStore((s) => s.latencyMs)
  const maxChannelCount = useUiStore((s) => s.maxChannelCount)
  const over = latencyMs > 25

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <span className="legend">Latency</span>
        <span
          className="numeric"
          data-testid="latency-readout"
          style={{ fontSize: 13, color: over ? 'var(--lamp)' : 'var(--ink)' }}
        >
          {latencyMs.toFixed(1)} ms{over ? ' !' : ''}
        </span>
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <span className="legend">Output</span>
        <span className="numeric" data-testid="channel-readout" style={{ fontSize: 13 }}>
          {maxChannelCount} ch
        </span>
      </span>
    </div>
  )
}
