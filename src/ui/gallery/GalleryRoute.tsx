import { useState } from 'react'
import { Button } from '../controls/Button.js'
import { Fader } from '../controls/Fader.js'
import { Legend } from '../controls/Legend.js'

/**
 * /dev/gallery — every control in every state, with no audio engine loaded.
 * Design here, not in the running app (§17.5). Nothing on this route may touch
 * the AudioContext; the gallery e2e test asserts none is constructed.
 */
export function GalleryRoute() {
  const [pitch, setPitch] = useState(0)

  return (
    <main style={{ padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-4)' }}>
      <h1 className="legend" style={{ fontSize: 20, color: 'var(--lamp)' }}>
        Gallery
      </h1>

      <Section title="Button">
        <Button>Default</Button>
        <Button active>Active</Button>
        <Button disabled reason="A YouTube deck has no EQ — the audio isn't available to the mixer">
          Disabled
        </Button>
      </Section>

      <Section title="Fader">
        <Fader
          label="Pitch"
          value={pitch}
          min={-8}
          max={8}
          onChange={setPitch}
          format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}
        />
      </Section>

      <Section title="Typography">
        <div style={{ display: 'grid', gap: 8 }}>
          <Legend>Panel legend — silkscreen</Legend>
          <span style={{ fontSize: 15 }}>Heading and track title, sentence case</span>
          <span className="numeric" style={{ fontSize: 56 }}>
            128.00
          </span>
          <span className="numeric" style={{ fontSize: 20 }}>
            0:00.0 · +8.00% · 42.0 ms
          </span>
        </div>
      </Section>

      <Section title="Palette">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['--void', '--panel', '--panel-up', '--legend', '--lamp', '--hot', '--deck-a', '--deck-b'].map((t) => (
            <div key={t} style={{ display: 'grid', gap: 4, width: 96 }}>
              <div style={{ height: 48, background: `var(${t})`, border: '1px solid var(--hairline)' }} />
              <span className="legend">{t.replace('--', '')}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel" style={{ padding: 'var(--space-2)', display: 'grid', gap: 'var(--space-2)' }}>
      <Legend>{title}</Legend>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {children}
      </div>
    </section>
  )
}
