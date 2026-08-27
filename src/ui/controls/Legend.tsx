import type { ReactNode } from 'react'

/** A silkscreen panel label. Uppercase because it is printed, not written. */
export function Legend({ children }: { children: ReactNode }) {
  return <span className="legend">{children}</span>
}
