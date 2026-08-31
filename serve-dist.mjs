#!/usr/bin/env node
/**
 * Zero-native-addon static server for the prebuilt HMI (dist/).
 * Prefer:  node start.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'))
const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '127.0.0.1'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found.')
  process.exit(1)
}

function safeFile(urlPath) {
  let rel = decodeURIComponent((urlPath || '/').split('?')[0]).replace(/^\/+/, '')
  if (!rel || rel.endsWith('/')) rel += 'index.html'
  if (rel.split(/[/\\]/).includes('..')) return null
  const abs = path.resolve(dist, rel)
  if (abs !== dist && !abs.startsWith(dist + path.sep)) return null
  return abs
}

http
  .createServer((req, res) => {
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
      res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    })
  })
  .on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error('Port ' + port + ' busy. Close other node.exe in Task Manager.')
      process.exit(1)
    }
    console.error(err)
    process.exit(1)
  })
  .listen(port, host, () => {
    console.log('Laser C-UAS HMI  http://' + host + ':' + port)
  })
