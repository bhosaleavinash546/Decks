import { useUiStore } from '../store/uiStore.js'

/**
 * Errors surface as a banner. Never a modal, never a blocked UI (§5.6). The
 * banner cannot cover the transport, and dismissing it is always available.
 */
export function ErrorBanner() {
  const banners = useUiStore((s) => s.banners)
  const dismiss = useUiStore((s) => s.dismissBanner)
  if (banners.length === 0) return null

  return (
    <div
      data-testid="error-banners"
      role="status"
      aria-live="polite"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 10 }}
    >
      {banners.map((b) => (
        <div
          key={b.id}
          className="panel"
          data-testid="error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 14px',
            border: '1px solid var(--hot)',
          }}
        >
          <span style={{ flex: 1, fontSize: 13 }}>
            {b.message}
            {b.detail ? <span style={{ color: 'var(--legend)' }}> — {b.detail}</span> : null}
          </span>
          <button type="button" onClick={() => dismiss(b.id)} className="legend" style={{ padding: 4 }}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
