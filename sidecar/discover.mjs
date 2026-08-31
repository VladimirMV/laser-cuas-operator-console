/**
 * Find Panoptes cameras on the LAN without mDNS.
 * Chrome already resolved *.local; Windows ARP then has their IPs.
 */
import os from 'node:os'
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const LONG_PATHS = ['/2k-stream', '/stream', '/mjpeg', '/video']
const IR_PATHS = ['/thermal/stream', '/thermal', '/ir-stream', '/ir']

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

function probe(ip, pathName, timeoutMs = 800) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    const req = http.get(
      {
        host: ip,
        path: pathName,
        timeout: timeoutMs,
        headers: { Connection: 'close', Accept: '*/*' },
      },
      (res) => {
        const ct = String(res.headers['content-type'] || '')
        try { res.destroy() } catch { /* */ }
        if (res.statusCode >= 200 && res.statusCode < 400) finish({ ip, path: pathName, ct })
        else finish(null)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      finish(null)
    })
    req.on('error', () => finish(null))
  })
}

async function firstHit(ips, paths, already) {
  const batch = 20
  for (let i = 0; i < ips.length; i += batch) {
    const slice = ips.slice(i, i + batch)
    const jobs = slice.flatMap((ip) =>
      paths.map(async (p) => {
        if (already.url) return null
        const r = await probe(ip, p)
        return r
      })
    )
    const results = await Promise.all(jobs)
    const hit = results.find(Boolean)
    if (hit) {
      already.url = `http://${hit.ip}${hit.path}`
      already.ip = hit.ip
      return already
    }
  }
  return already
}

export async function discoverPanoptes({ scan = false } = {}) {
  const found = { LONG: { url: null, ip: null }, IR: { url: null, ip: null } }
  let ips = await arpIps()
  if (scan || ips.length < 2) {
    const extra = []
    for (const n of localSubnets()) {
      for (let i = 1; i < 255; i++) extra.push(`${n.prefix}.${i}`)
    }
    ips = [...new Set([...ips, ...extra])]
  }
  await firstHit(ips, LONG_PATHS, found.LONG)
  await firstHit(ips, IR_PATHS, found.IR)
  return {
    LONG: found.LONG.url,
    IR: found.IR.url,
    ips: ips.length,
    scanned: scan || ips.length > 30,
  }
}
