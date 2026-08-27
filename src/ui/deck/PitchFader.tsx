import { Fader } from '../controls/Fader.js'
import { percent } from '../format.js'

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
      format={percent}
    />
  )
}
