// Dropping COOP/COEP is necessary for a signed-in YouTube embed. It may not be
// sufficient: an embedded player is a THIRD-PARTY context, so its session also
// depends on third-party cookie policy. This probes that, using two different
// hosts on loopback (cookies are host-scoped and ignore port, so two ports
// would share one jar and prove nothing).
import http from 'node:http'

const TOP = 8841 // served on 127.0.0.1  — plays the app
const EMB = 8842 // served on localhost   — plays YouTube
let result = null

const topPage = `<!doctype html><meta charset="utf-8"><body><script>
addEventListener('message', (e) => {
  if (typeof e.data === 'string' && e.data.startsWith('{')) {
    navigator.sendBeacon('/result', e.data)
  }
})
const f = document.createElement('iframe')
f.src = 'http://localhost:${EMB}/embed'
document.body.appendChild(f)
</script></body>`

// The embedded origin sets a cookie on first load and reports on the second
// whether the browser sent it back inside the third-party context.
http.createServer((req, res) => {
  const seen = req.headers.cookie ?? ''
  if (req.url === '/embed') {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Set-Cookie': 'session=premium; SameSite=None; Secure; Path=/; Max-Age=600',
    })
    res.end(`<!doctype html><meta charset="utf-8"><body><script>
      fetch('/check', { credentials: 'include' })
        .then(r => r.json())
        .then(d => parent.postMessage(JSON.stringify({
          cookieSentOnSubresource: d.cookieSeen,
          cookieVisibleToScript: document.cookie.includes('session'),
          hasStorageAccessApi: typeof document.requestStorageAccess === 'function',
        }), '*'))
    </script></body>`)
    return
  }
  if (req.url === '/check') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ cookieSeen: seen.includes('session=premium') }))
    return
  }
  res.writeHead(404).end()
}).listen(EMB, '0.0.0.0')

http.createServer((req, res) => {
  if (req.method === 'POST') {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => { result = b; console.log('COOKIE ' + b); res.writeHead(204).end() })
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(topPage)
}).listen(TOP, '127.0.0.1', () => console.log(`cookie probe http://127.0.0.1:${TOP}/`))

setTimeout(() => { if (!result) console.log('COOKIE {"error":"no result"}'); process.exit(0) }, 15000)
