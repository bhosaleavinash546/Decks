import type { ReactNode } from 'react'

/**
 * State flips instantly; only the feedback decays, over 70 ms and decelerating
 * only. No scale, no bounce — a spring on a transport button reads as lag.
 */
export function Button({
  children,
  onClick,
  active = false,
  disabled = false,
  reason,
  'data-testid': testId,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  reason?: string
  'data-testid'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-pressed={active}
      // Disabled controls are shown, never hidden, and explain themselves (§16).
      title={disabled ? reason : undefined}
      className="raised"
      style={{
        minWidth: 32,
        minHeight: 32,
        padding: '6px 12px',
        color: active ? 'var(--lamp)' : 'var(--ink)',
        border: `1px solid ${active ? 'var(--lamp)' : 'var(--hairline)'}`,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: `color var(--t-tap) var(--e-tap), border-color var(--t-tap) var(--e-tap)`,
      }}
    >
      <span className="legend" style={{ color: 'inherit' }}>
        {children}
      </span>
    </button>
  )
}
