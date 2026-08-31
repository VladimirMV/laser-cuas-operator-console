#!/usr/bin/env node
/**
 * One-window launcher: sidecar + HMI static server + browser.
 *   node start.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, exec } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
const sidecarDir = path.join(root, 'sidecar')
const logFile = path.join(root, 'start.log')
const HOST = '127.0.0.1'
const SIDECAR_PORT = 8787
const HMI_PORTS = [5173, 5174, 5175]

const logStream = fs.createWriteStream(logFile, { flags: 'a' })
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`
  console.log(args.join(' '))
  try { logStream.write(line + '\n') } catch { /* */ }
}

function mime(ext) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  }[ext] || 'application/octet-stream'
}

function safeFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0])
  rel = rel.replace(/^\/+/, '')
  if (!rel || rel.endsWith('/')) rel += 'index.html'
  rel = rel.replace(/\\/g, '/')
  if (rel.split('/').includes('..')) return null
  const abs = path.resolve(dist, rel)
  const base = path.resolve(dist)
  if (abs !== base && !abs.startsWith(base + path.sep)) return null
  return abs
}

function serveDist(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = safeFile(req.url || '/')
      if (!file) {
        res.writeHead(403)
        return res.end('forbidden')
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain' })
          return res.end('not found')
        }
        res.writeHead(200, { 'content-type': mime(path.extname(file).toLowerCase()) })
        res.end(data)
      })
    })
    server.once('error', reject)
    server.listen(port, HOST, () => resolve(server))
  })
}

async function waitHealth(url, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) })
      if (r.ok) return true
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

function openBrowser(url) {
  const plat = process.platform
  if (plat === 'win32') exec(`start "" "${url}"`)
  else if (plat === 'darwin') exec(`open "${url}"`)
  else exec(`xdg-open "${url}"`)
}

function spawnSidecar() {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: sidecarDir,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
  })
  const pipe = (buf) => {
    const s = buf.toString()
    process.stdout.write(s)
    try { logStream.write(s) } catch { /* */ }
  }
  child.stdout.on('data', pipe)
  child.stderr.on('data', pipe)
  child.on('exit', (code) => log('[launcher] sidecar exit', String(code)))
  return child
}

async function main() {
  log('Laser C-UAS launcher')
  log('root=', root)
  log('node=', process.execPath, process.version)

  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    log('ERROR: dist/index.html missing — unzip the full archive, do not copy files one by one')
    process.exit(1)
  }
  if (!fs.existsSync(path.join(sidecarDir, 'server.mjs'))) {
    log('ERROR: sidecar/server.mjs missing')
    process.exit(1)
  }

  let sidecar = null
  const already = await waitHealth(`http://${HOST}:${SIDECAR_PORT}/health`, 800)
  if (already) {
    log('sidecar already running on', String(SIDECAR_PORT))
  } else {
    log('starting sidecar...')
    sidecar = spawnSidecar()
    const ok = await waitHealth(`http://${HOST}:${SIDECAR_PORT}/health`, 20000)
    if (!ok) log('WARNING: sidecar /health not ready — HMI will still start. Check lines above.')
    else log('sidecar OK  http://' + HOST + ':' + SIDECAR_PORT)
  }

  let hmiPort = null
  for (const p of HMI_PORTS) {
    try {
      await serveDist(p)
      hmiPort = p
      break
    } catch (e) {
      if (e && e.code === 'EADDRINUSE') {
        log('port', String(p), 'busy, trying next')
        continue
      }
      throw e
    }
  }
  if (!hmiPort) {
    log('ERROR: ports 5173-5175 busy. Close old node windows (Диспетчер задач → node.exe).')
    process.exit(1)
  }

  const url = `http://${HOST}:${hmiPort}`
  log('HMI', url)
  log('live LONG  http://' + HOST + ':' + SIDECAR_PORT + '/live/LONG')
  log('Keep this window open. Ctrl+C to stop.')
  openBrowser(url)

  const stop = () => {
    if (sidecar && !sidecar.killed) {
      try { sidecar.kill() } catch { /* */ }
    }
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((e) => {
  log('FATAL', e && e.stack ? e.stack : String(e))
  process.exit(1)
})
