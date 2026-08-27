// A display that sleeps mid-party is a bug (§13).
//
// The lock is dropped by the browser whenever the tab is hidden, so it has to be
// re-acquired on visibilitychange rather than requested once at startup.

import { reportError } from '../engine/errors.js'

let sentinel: WakeLockSentinel | null = null
let wanted = false

async function acquire(): Promise<void> {
  if (!wanted || sentinel) return
  const wl = navigator.wakeLock
  if (!wl) return
  try {
    sentinel = await wl.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
  } catch (cause) {
    // Denied or unsupported. Not worth a banner mid-set; the screen may sleep.
    reportError('Could not keep the screen awake', cause)
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') void acquire()
}

/** Hold a screen wake lock for as long as the app is in the foreground. */
export function startWakeLock(): () => void {
  wanted = true
  void acquire()
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    wanted = false
    document.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release()
    sentinel = null
  }
}

export function wakeLockHeld(): boolean {
  return sentinel !== null
}
