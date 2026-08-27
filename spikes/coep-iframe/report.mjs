// Turns results.json into the verdict table.
import { readFileSync } from 'node:fs'

const { results } = JSON.parse(readFileSync(process.argv[2] ?? 'results.json', 'utf8'))
const pad = (s, n) => String(s).padEnd(n)

console.log('')
console.log(pad('CASE', 32), pad('ISOLATED', 10), pad('SAB', 14), pad('IFRAME', 10), pad('CMD', 6), 'VERDICT')
console.log('-'.repeat(90))

for (const r of results) {
  // Both halves must hold: SAB for the audio engine, handshake for the YouTube deck.
  const usable = r.crossOriginIsolated && r.sab === 'constructed' && r.handshake && r.commandAck
  const verdict = usable
    ? 'WORKS — isolated AND third-party iframe live'
    : r.crossOriginIsolated && r.sab === 'constructed'
      ? 'iframe BLOCKED (no handshake)'
      : r.handshake
        ? 'iframe fine, but NOT isolated — no SharedArrayBuffer'
        : 'neither'
  console.log(
    pad(r.case, 32),
    pad(r.crossOriginIsolated ? 'yes' : 'no', 10),
    pad(r.sab, 14),
    pad(r.handshake ? 'live' : 'dead', 10),
    pad(r.commandAck ? 'ack' : '--', 6),
    verdict,
  )
}
console.log('')
console.log('credentialless attribute supported:', results[0]?.credentiallessAttrSupported)
