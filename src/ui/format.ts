// Display formatting for the numeric readouts.
//
// Kept out of the components so the boundary cases can be tested. They matter:
// splitting minutes and seconds before rounding renders 59.98 s as "0:60.0".

/** `m:ss.t` — minutes, seconds, tenths. */
export function clock(sec: number): string {
  const s = Math.max(0, sec)
  // Round to tenths FIRST, then split. Splitting first and rounding the
  // remainder lets 59.98 round up to "60.0" inside minute 0.
  const tenths = Math.round(s * 10)
  const minutes = Math.floor(tenths / 600)
  const rest = (tenths - minutes * 600) / 10
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

/** Signed percentage, as the pitch fader shows it. */
export function percent(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}
