import { Fader } from '../controls/Fader.js'

/** ±8% is what actually gets used; the fader travels 220px minimum (§15). */
export function PitchFader({ value, onChange }: { value: number; onChange: (rate: number) => void }) {
  return (
    <Fader
      label="Pitch"
      data-testid="pitch-fader"
      value={value}
      min={-8}
      max={8}
      travelPx={220}
      onChange={onChange}
      format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
    />
  )
}
