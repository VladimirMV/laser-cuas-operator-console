#!/usr/bin/env node
/**
 * Zero-native-addon static server for the prebuilt HMI (dist/).
 * Uses only Node stdlib — no Vite, esbuild, or Rollup.
 *   node serve-dist.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
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

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('dist/index.html not found. Run this from the project root after a build.')
  process.exit(1)
}

http
  .createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${host}`)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel.endsWith('/')) rel = path.join(rel, 'index.html')
    const file = path.normalize(path.join(root, rel))
    if (!file.startsWith(root)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not found')
        return
      }
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' })
      res.end(data)
    })
  })
  .listen(port, host, () => {
    console.log(`Laser C-UAS HMI 1.8.0  http://${host}:${port}`)
  })
