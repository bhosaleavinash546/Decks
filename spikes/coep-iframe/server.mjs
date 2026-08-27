// COEP / cross-origin-isolation iframe spike.
//
// Question: under the cross-origin isolation headers DECKS needs for SharedArrayBuffer,
// can we still embed a third-party iframe that sends no COEP headers of its own?
// YouTube sends none, so this decides whether the Phase 6 YouTube deck is possible.
//
// Two origins. APP_PORT plays the DECKS app and varies its isolation headers per case.
// THIRD_PORT plays the third party: it sends no COEP, no CORP, no X-Frame-Options,
// and postMessages a handshake to its parent exactly the way the YouTube IFrame
// Player API does. A different port is a different origin for these checks.
//
// Usage: node server.mjs           (serves both origins, prints results as they arrive)

import http from 'node:http'

const APP_PORT = Number(process.env.APP_PORT ?? 8801)
const THIRD_PORT = Number(process.env.THIRD_PORT ?? 8802)
const THIRD_ORIGIN = `http://127.0.0.1:${THIRD_PORT}`

/** Isolation headers per case. The child page never changes; only these do. */
const CASES = {
  'control-no-isolation': {
    label: 'No isolation headers (control)',
    headers: {},
    credentiallessAttr: false,
  },
  'coep-require-corp': {
    label: 'COOP same-origin + COEP require-corp, plain iframe',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    credentiallessAttr: false,
  },
  'coep-credentialless': {
    label: 'COOP same-origin + COEP credentialless, plain iframe',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    credentiallessAttr: false,
  },
  'coep-credentialless-attr': {
    label: 'COOP same-origin + COEP credentialless, <iframe credentialless>',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    credentiallessAttr: true,
  },
  'document-isolation-policy': {
    label: 'Document-Isolation-Policy isolate-and-credentialless, plain iframe',
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Document-Isolation-Policy': 'isolate-and-credentialless',
    },
    credentiallessAttr: false,
  },
}

export const CASE_IDS = Object.keys(CASES)

const thirdPartyHits = []
const results = []

const appPage = (caseId) => `<!doctype html>
<meta charset="utf-8">
<title>${caseId}</title>
<body>
<script>
const CASE = ${JSON.stringify(caseId)}
const CREDENTIALLESS = ${CASES[caseId].credentiallessAttr}
const THIRD = ${JSON.stringify(THIRD_ORIGIN)}

const errors = []
addEventListener('error', (e) => errors.push(String(e.message)))

function sabProbe() {
  if (typeof SharedArrayBuffer === 'undefined') return 'undefined'
  try {
    const sab = new SharedArrayBuffer(1024)
    return sab.byteLength === 1024 ? 'constructed' : 'wrong-size'
  } catch (err) {
    return 'threw: ' + err.name
  }
}

const result = {
  case: CASE,
  crossOriginIsolated: self.crossOriginIsolated === true,
  sab: sabProbe(),
  iframeLoadEvent: false,
  handshake: false,
  handshakeDetail: null,
  commandAck: false,
}

// The IFrame Player API talks to the page purely over postMessage, so a handshake
// arriving is the signal that a real YouTube player could be driven from here.
addEventListener('message', (e) => {
  if (e.origin !== THIRD) return
  let data = e.data
  try { data = JSON.parse(data) } catch {}
  if (data && data.spike === 'ready') {
    result.handshake = true
    result.handshakeDetail = data
    // The API drives the player by postMessage INTO the frame, so prove that direction too.
    frame.contentWindow.postMessage(JSON.stringify({ spike: 'command', command: 'setVolume' }), '*')
  }
  if (data && data.spike === 'ack') {
    result.commandAck = true
  }
})

const frame = document.createElement('iframe')
if (CREDENTIALLESS) frame.credentialless = true
frame.width = 320
frame.height = 180
frame.addEventListener('load', () => { result.iframeLoadEvent = true })
frame.src = THIRD + '/player.html?case=' + encodeURIComponent(CASE)
document.body.appendChild(frame)

// The blocked case fires no handshake, so the wait has to time out rather than resolve.
setTimeout(() => {
  result.credentiallessAttrSupported = 'credentialless' in HTMLIFrameElement.prototype
  result.errors = errors
  navigator.sendBeacon('/result', JSON.stringify(result))
  document.title = 'done:' + CASE
}, 2500)
</script>
</body>`

// --- third-party origin: sends nothing that opts into cross-origin isolation -------
http
  .createServer((req, res) => {
    const url = new URL(req.url, THIRD_ORIGIN)
    thirdPartyHits.push(`${url.pathname}${url.search}`)
    if (url.pathname === '/player.html') {
      // Deliberately bare: no COEP, no CORP, no X-Frame-Options. This is the
      // header posture YouTube's /embed endpoint actually has.
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!doctype html>
<meta charset="utf-8">
<title>third party</title>
<body style="margin:0;background:#333;color:#eee;font:12px sans-serif">
third-party player stand-in
<script>
  addEventListener('message', (e) => {
    let d = e.data
    try { d = JSON.parse(d) } catch {}
    if (d && d.spike === 'command') {
      parent.postMessage(JSON.stringify({ spike: 'ack', command: d.command }), '*')
    }
  })
  parent.postMessage(JSON.stringify({
    spike: 'ready',
    origin: location.origin,
    cookiesVisible: document.cookie.length > 0,
  }), '*')
</script>
</body>`)
      return
    }
    res.writeHead(404).end()
  })
  .listen(THIRD_PORT, '127.0.0.1')

// --- app origin: isolation headers vary per case -----------------------------------
http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${APP_PORT}`)

    if (req.method === 'POST' && url.pathname === '/result') {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        try {
          results.push(JSON.parse(body))
        } catch {
          results.push({ case: 'unparseable', body })
        }
        res.writeHead(204).end()
      })
      return
    }

    if (url.pathname === '/results.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ results, thirdPartyHits }, null, 2))
      return
    }

    const caseId = url.pathname.slice(1).replace(/\.html$/, '')
    const spec = CASES[caseId]
    if (!spec) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...spec.headers })
    res.end(appPage(caseId))
  })
  .listen(APP_PORT, '127.0.0.1', () => {
    console.log(`app      http://127.0.0.1:${APP_PORT}/<case>.html`)
    console.log(`third    ${THIRD_ORIGIN}/player.html`)
    console.log(`cases    ${CASE_IDS.join(', ')}`)
  })

export { CASES }
