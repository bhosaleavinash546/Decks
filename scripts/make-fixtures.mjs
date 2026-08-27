// Generates the audio fixtures the e2e tests load. Not committed — a minute of
// 48 kHz stereo is 11 MB and it is deterministic anyway.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'

const DIR = new URL('../tests/fixtures/', import.meta.url)
mkdirSync(DIR, { recursive: true })

function wav(samples, sampleRate = 48000, channels = 2) {
  const bytes = samples.length * channels * 2
  const buf = Buffer.alloc(44 + bytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + bytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(channels, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * channels * 2, 28)
  buf.writeUInt16LE(channels * 2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(bytes, 40)
  let o = 44
  for (const s of samples) {
    const v = Math.max(-1, Math.min(1, s))
    const i = Math.round(v * 32767)
    for (let c = 0; c < channels; c++) {
      buf.writeInt16LE(i, o)
      o += 2
    }
  }
  return buf
}

function tone(seconds, freq, sampleRate = 48000, amp = 0.5) {
  const n = seconds * sampleRate
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * amp
  return out
}

const files = [
  ['sine-1k-60s.wav', () => wav(tone(60, 1000))],
  ['sine-1k-10s.wav', () => wav(tone(10, 1000))],
  ['silence-10s.wav', () => wav(new Float32Array(10 * 48000))],
]

for (const [name, make] of files) {
  const path = new URL(name, DIR)
  if (existsSync(path) && !process.env.FORCE) {
    console.log(`${name} — exists`)
    continue
  }
  const buf = make()
  writeFileSync(path, buf)
  console.log(`${name}  ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
}
