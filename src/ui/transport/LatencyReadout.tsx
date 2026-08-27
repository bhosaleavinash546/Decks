import { useUiStore } from '../../store/uiStore.js'

/**
 * baseLatency + outputLatency (§13). The Phase 1 gate is under 25 ms, so the
 * number turns amber above it rather than quietly sitting there being bad.
 *
 * State, not colour alone: over budget also gets a marker (§18).
 */
export function LatencyReadout() {
  const latencyMs = useUiStore((s) => s.latencyMs)
  const outputLatencyMs = useUiStore((s) => s.outputLatencyMs)
  const maxChannelCount = useUiStore((s) => s.maxChannelCount)
  // §13 wants baseLatency + outputLatency displayed; the Phase 1 gate in §20 is
  // on outputLatency ALONE. Showing the sum but grading it against the
  // outputLatency budget failed a machine that was actually inside it.
  const over = outputLatencyMs > 25

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <span className="legend">Latency</span>
        <span
          className="numeric"
          data-testid="latency-readout"
          style={{ fontSize: 13, color: over ? 'var(--lamp)' : 'var(--ink)' }}
          title={`base ${(latencyMs - outputLatencyMs).toFixed(2)} ms + output ${outputLatencyMs.toFixed(2)} ms — the gate is on output alone, under 25 ms`}
        >
          {latencyMs.toFixed(1)} ms{over ? ' !' : ''}
        </span>
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
        <span className="legend">Out latency</span>
        <span
          className="numeric"
          data-testid="output-latency-readout"
          style={{ fontSize: 13, color: over ? 'var(--lamp)' : 'var(--ink)' }}
        >
          {outputLatencyMs.toFixed(1)} ms
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
