// Serves the option 4 spike with NO COOP/COEP headers — the whole point is that
// this page needs no cross-origin isolation.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8821)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' }

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (req.method === 'POST' && url.pathname === '/result') {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => { console.log('RESULT ' + b); res.writeHead(204).end() })
    return
  }
  const name = url.pathname === '/' ? '/page.html' : url.pathname
  try {
    const body = readFileSync(join(DIR, name.replace(/[^a-zA-Z0-9._/-]/g, '')))
    const ext = name.slice(name.lastIndexOf('.'))
    res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(PORT, '127.0.0.1', () => console.log(`spike http://127.0.0.1:${PORT}/`))
