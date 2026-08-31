/**
 * Find Panoptes cameras. Never pick a random LAN host that answers 200 on /video.
 * Score: JPEG/multipart body, exact paths, 192.168.80.x. Reject HTML and tiny replies.
 */
import os from 'node:os'
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const LONG_PATHS = ['/2k-stream', '/stream']
const IR_PATHS = ['/thermal/stream', '/thermal']
const PREFER_PREFIX = '192.168.80.'

function parseIps(text) {
  const ips = new Set()
  for (const m of String(text).matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g)) {
    const ip = m[1]
    const o = ip.split('.').map(Number)
    if (o.some((n) => n > 255)) continue
    if (o[0] === 127 || o[0] >= 224) continue
    if (o[3] === 0 || o[3] === 255) continue
    ips.add(ip)
  }
  return [...ips]
}

async function arpIps() {
  try {
    const { stdout } = await execFileAsync(process.platform === 'win32' ? 'arp' : 'arp', ['-a'], {
      timeout: 5000,
      windowsHide: true,
    })
    return parseIps(stdout)
  } catch {
    return []
  }
}

function localSubnets() {
  const nets = []
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      const fam = a.family
      if (fam !== 'IPv4' && fam !== 4) continue
      if (a.internal) continue
      const parts = a.address.split('.')
      if (parts.length !== 4) continue
      nets.push({ self: a.address, prefix: parts.slice(0, 3).join('.') })
    }
  }
  return nets
}

function scoreHead({ ip, pathName, ct, cl, status, head }) {
  if (status < 200 || status >= 400) return 0
  if (cl > 0 && cl < 2048) return 0
  const latin = head.toString('latin1')
  if (/<!doctype|<html|not found|404/i.test(latin)) return 0
  const jpeg = head.length >= 2 && head[0] === 0xff && head[1] === 0xd8
  const multi = latin.startsWith('--')
  const h264 = head.length >= 4 && head[0] === 0 && head[1] === 0 && (head[2] === 0 || head[2] === 1)
  let s = 0
  if (jpeg) s += 60
  if (multi) s += 50
  if (h264) s += 20
  if (/mjpeg|multipart|image\/jpeg/i.test(ct)) s += 25
  else if (/octet-stream|video\//i.test(ct)) s += 10
  if (pathName === '/2k-stream' || pathName === '/thermal/stream') s += 35
  if (ip.startsWith(PREFER_PREFIX)) s += 40
  return s
}

export function probeUrl(url, timeoutMs = 1800) {
  return new Promise((resolve) => {
    let u
    try { u = new URL(url) } catch { return resolve(null) }
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    const req = http.get(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        timeout: timeoutMs,
        headers: { Connection: 'close', Accept: '*/*', 'User-Agent': 'Laser-CUAS-sidecar/1.8.1' },
      },
      (res) => {
        const chunks = []
        const take = (c) => {
          chunks.push(c)
          if (Buffer.concat(chunks).length >= 80) {
            try { res.destroy() } catch { /* */ }
          }
        }
        res.on('data', take)
        const wrap = () => {
          const head = Buffer.concat(chunks)
          const row = {
            ip: u.hostname,
            pathName: u.pathname,
            ct: String(res.headers['content-type'] || ''),
            cl: Number(res.headers['content-length'] || 0),
            status: res.statusCode,
            head,
          }
          const score = scoreHead(row)
          if (score < 30) return finish(null)
          finish({
            url: `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`,
            ip: u.hostname,
            path: u.pathname,
            ct: row.ct,
            score,
            cl: row.cl,
          })
        }
        res.on('end', wrap)
        res.on('close', wrap)
      }
    )
    req.on('timeout', () => { req.destroy(); finish(null) })
    req.on('error', () => finish(null))
  })
}

function probe(ip, pathName, timeoutMs = 1800) {
  return probeUrl(`http://${ip}${pathName}`, timeoutMs)
}

export async function discoverPanoptes({ scan = false } = {}) {
  let ips = await arpIps()
  if (scan || ips.length < 2) {
    const extra = []
    for (const n of localSubnets()) {
      for (let i = 1; i < 255; i++) extra.push(`${n.prefix}.${i}`)
    }
    ips = [...new Set([...ips, ...extra])]
  }
  ips.sort((a, b) => {
    const ap = a.startsWith(PREFER_PREFIX) ? 0 : 1
    const bp = b.startsWith(PREFER_PREFIX) ? 0 : 1
    return ap - bp || a.localeCompare(b, undefined, { numeric: true })
  })

  async function best(paths) {
    let winner = null
    const batch = 12
    for (let i = 0; i < ips.length; i += batch) {
      const slice = ips.slice(i, i + batch)
      const jobs = slice.flatMap((ip) => paths.map((p) => probe(ip, p)))
      const results = (await Promise.all(jobs)).filter(Boolean)
      for (const r of results) {
        if (!winner || r.score > winner.score) winner = r
      }
      if (winner && winner.score >= 80 && winner.ip.startsWith(PREFER_PREFIX)) break
    }
    return winner
  }

  const long = await best(LONG_PATHS)
  const ir = await best(IR_PATHS)
  if (long) console.log(`[sidecar] discover LONG score=${long.score} ${long.url} ct=${long.ct}`)
  if (ir) console.log(`[sidecar] discover IR score=${ir.score} ${ir.url} ct=${ir.ct}`)
  return { LONG: long?.url || null, IR: ir?.url || null, ips: ips.length }
}
