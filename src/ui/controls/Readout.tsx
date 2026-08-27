import { useEffect, useRef } from 'react'
import { subscribeFrame } from '../frame/frameLoop.js'

/**
 * A number the frame loop owns. `read` runs once per frame and the result goes
 * straight to textContent — this component never re-renders for a value change.
 */
export function Readout({
  read,
  label,
  size = 20,
  title,
}: {
  read: () => string
  label?: string
  size?: number
  title?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let last = ''
    return subscribeFrame(() => {
      const el = ref.current
      if (!el) return
      const next = read()
      // Writing textContent unconditionally dirties layout every frame.
      if (next !== last) {
        el.textContent = next
        last = next
      }
    })
  }, [read])

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }} title={title}>
      {label ? <span className="legend">{label}</span> : null}
      <span ref={ref} className="numeric" style={{ fontSize: size, lineHeight: 1 }} />
    </span>
  )
}
