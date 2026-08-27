import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NO COOP/COEP.
//
// Cross-origin isolation is required only by SharedArrayBuffer, and the option 4
// spike (docs/spikes/02) established that nothing in this app needs one: the
// playhead is derived from the audio clock, PCM is transferred, and meters come
// from an AnalyserNode. Isolating the document would force every third-party
// iframe into a credentialless — signed out — context, which means ads mid-track
// on a Premium account.
//
// Do not add these headers back without re-reading that spike.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
})
