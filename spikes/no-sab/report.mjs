// Turns results.json into the four answers the spike was commissioned to give.
import { readFileSync } from 'node:fs'

const r = JSON.parse(readFileSync(process.argv[2] ?? 'results.json', 'utf8'))
if (r.error) { console.error('spike failed:', r.error); process.exit(1) }

const ms = (samples) => (samples / r.sampleRate * 1000).toFixed(3)
const row = (k, v) => console.log('  ' + k.padEnd(38) + v)

console.log(`\nDECKS option 4 — ${r.durationSec}s, ${r.sampleRate} Hz, ${r.rateChanges} rate changes\n`)

console.log('isolation actually dropped')
row('crossOriginIsolated', r.crossOriginIsolated)
row('SharedArrayBuffer available', r.sabAvailable)
row('PCM transferred (main copy detached)', r.pcmDetached)

console.log('\n1. derived playhead accuracy')
row('ramp-modelled error, max', `${r.formulaErrorSamples.ramped.max} samples (${ms(r.formulaErrorSamples.ramped.max)} ms)`)
row('ramp-modelled error, final', `${r.formulaErrorSamples.ramped.final} samples`)
row('naive (ramp ignored), max', `${r.formulaErrorSamples.naive.max} samples (${ms(r.formulaErrorSamples.naive.max)} ms)`)
row('xruns', r.xruns)

console.log('\n2. regression vs the SAB design')
row('rAF frames / fps', `${r.rafFrames} / ${r.fps}`)
row('read jitter, ctx.currentTime', `${r.readJitterSamplesStd.currentTime} samples sd`)
row('read jitter, getOutputTimestamp', `${r.readJitterSamplesStd.outputTimestamp} samples sd`)
row('render clock ahead of audible', `${r.renderAheadOfAudibleSamples} samples (${ms(r.renderAheadOfAudibleSamples)} ms)`)
row('impulses emitted / caught', `${r.metering.impulsesEmitted} / ${r.metering.impulsesSeen}`)
row('max peak seen by AnalyserNode', r.metering.maxPeak)

console.log('\nlatency')
row('baseLatency', `${(r.baseLatency * 1000).toFixed(2)} ms`)
row('outputLatency', `${(r.outputLatency * 1000).toFixed(2)} ms`)
row('total', `${((r.baseLatency + r.outputLatency) * 1000).toFixed(2)} ms`)
console.log('')
