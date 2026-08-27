import { reportError } from '../engine/errors.js'

/** Register the service worker so Chrome offers Install. Never blocks startup. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((cause) => reportError('Could not register the service worker', cause))
  })
}
