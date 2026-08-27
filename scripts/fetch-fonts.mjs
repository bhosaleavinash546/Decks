// Fetches and self-hosts the three faces the design system needs.
// No CDN at runtime — §14.4 is explicit that this must work on flaky party wifi.
// Run once: `npm run fonts`. The woff2 files are committed.
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

// Archivo is one variable family with a width axis, so the condensed panel
// legends and the regular headings come from the same file.
const FACES = [
  { file: 'archivo-var.woff2', css: 'family=Archivo:wdth,wght@62..125,400..700' },
  { file: 'ibm-plex-mono-500.woff2', css: 'family=IBM+Plex+Mono:wght@500' },
]

mkdirSync(new URL('../public/fonts/', import.meta.url), { recursive: true })

for (const face of FACES) {
  const cssUrl = `https://fonts.googleapis.com/css2?${face.css}&display=block`
  const css = await fetch(cssUrl, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  // Latin subset only: the first src the sheet offers for the latin unicode-range.
  const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1])
  if (!urls.length) throw new Error(`no woff2 in ${cssUrl}`)
  const buf = await fetch(urls[urls.length - 1], { headers: { 'User-Agent': UA } }).then((r) => r.arrayBuffer())
  const out = new URL(`../public/fonts/${face.file}`, import.meta.url)
  writeFileSync(out, Buffer.from(buf))
  console.log(`${face.file}  ${(buf.byteLength / 1024).toFixed(1)} kB`)
}
