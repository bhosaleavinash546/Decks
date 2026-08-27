import { useCallback, useRef } from 'react'

/**
 * 1:1 with the cursor, zero easing, ever. Smoothing on a fader is a lie about
 * where the audio is (§16). Shift-drag is 1/8 sensitivity.
 */
export function Fader({
  value,
  min,
  max,
  onChange,
  travelPx = 220,
  label,
  format,
  'data-testid': testId,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  travelPx?: number
  label: string
  format: (v: number) => string
  'data-testid'?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startValue: number } | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startValue: valueRef.current }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const sensitivity = (e.shiftKey ? 1 / 8 : 1) * ((max - min) / travelPx)
      // Down is slower, matching a pitch fader.
      onChange(clamp(d.startValue - (e.clientY - d.startY) * sensitivity, min, max))
    },
    [max, min, onChange, travelPx],
  )

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = (max - min) / (e.shiftKey ? 800 : 100)
      if (e.key === 'ArrowUp') onChange(clamp(valueRef.current + step, min, max))
      else if (e.key === 'ArrowDown') onChange(clamp(valueRef.current - step, min, max))
      else if (e.key === 'Home') onChange((min + max) / 2)
      else return
      e.preventDefault()
    },
    [max, min, onChange],
  )

  const frac = (value - min) / (max - min)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span className="legend">{label}</span>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        data-testid={testId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="raised"
        style={{
          position: 'relative',
          width: 40,
          height: travelPx,
          border: `1px solid var(--hairline)`,
          cursor: 'ns-resize',
          touchAction: 'none',
        }}
      >
        {/* Centre detent, so the position is readable without reading the number. */}
        <div style={{ position: 'absolute', left: 4, right: 4, top: '50%', height: 1, background: 'var(--hairline)' }} />
        <div
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            height: 10,
            borderRadius: 2,
            background: 'var(--lamp)',
            // Only transform is animated — and here, not even that.
            transform: `translateY(${(1 - frac) * (travelPx - 12)}px)`,
          }}
        />
      </div>
      <span className="numeric" style={{ fontSize: 13 }}>
        {format(value)}
      </span>
    </div>
  )
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
