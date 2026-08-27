// 4-point cubic Hermite interpolation.
//
// Never linear: it aliases audibly on pitch changes. Windowed-sinc is
// unnecessary at the ±8% this app actually uses (§7.2).

/**
 * Interpolate between `y1` and `y2` at fractional position `frac` (0..1), using
 * `y0` and `y3` as the outer control points.
 */
export function hermite4(y0: number, y1: number, y2: number, y3: number, frac: number): number {
  const c0 = y1
  const c1 = 0.5 * (y2 - y0)
  const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3
  const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2)
  return ((c3 * frac + c2) * frac + c1) * frac + c0
}
