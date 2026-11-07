#!/usr/bin/env node
// Drives headless Chrome through render.html and saves a 1600x1373 PNG of one layer.
//
//   node scripts/map/capture.mjs karta|reljef <out.png>
//
// Needs Google Chrome (CHROME env var overrides the macOS path) and Node 22 (global WebSocket/fetch).
// Convert the PNG to WebP afterwards, see README.md.

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [layer, out] = process.argv.slice(2)
if (!['karta', 'reljef'].includes(layer) || !out) {
  console.error('usage: capture.mjs karta|reljef <out.png>')
  process.exit(1)
}
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const page = fileURLToPath(new URL('./render.html', import.meta.url))
const port = 9300 + Math.floor(Math.random() * 500)

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, '--window-size=1600,1373', '--hide-scrollbars',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--user-data-dir=${process.env.TMPDIR ?? '/tmp'}/ksh-map-capture-${port}`, 'about:blank'
], { stdio: 'ignore' })

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function main() {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page')
    } catch {
      await sleep(200)
    }
  }
  if (!target) throw new Error('Chrome did not start')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    pending.set(++id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1373, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `file://${page}?layer=${layer}` })
  for (let i = 0; i < 150; i++) {
    const r = await send('Runtime.evaluate', { expression: 'document.title' })
    if (r.result?.result?.value === 'ready') break
    if (i === 149) throw new Error('map never became ready')
    await sleep(500)
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`wrote ${out}`)
  ws.close()
}
try {
  await main()
} finally {
  proc.kill()
}
