/**
 * Tiny mDNS A-lookup (UDP 224.0.0.251:5353).
 * Chrome resolves *.local; Node/FFmpeg on Windows often do not.
 */
import dgram from 'node:dgram'
import dns from 'node:dns/promises'
import net from 'node:net'
import { execFile } from 'node:child_process'

function encodeName(name) {
  const parts = String(name).replace(/\.$/, '').split('.')
  const chunks = parts.map((p) => {
    const b = Buffer.from(p)
    return Buffer.concat([Buffer.from([b.length]), b])
  })
  return Buffer.concat([...chunks, Buffer.from([0])])
}

function readName(buf, offset) {
  const labels = []
  let jumped = false
  let pos = offset
  let end = offset
  let guard = 0
  while (guard++ < 32) {
    if (pos >= buf.length) break
    const len = buf[pos]
    if (len === 0) {
      if (!jumped) end = pos + 1
      break
    }
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | buf[pos + 1]
      if (!jumped) end = pos + 2
      pos = ptr
      jumped = true
      continue
    }
    labels.push(buf.slice(pos + 1, pos + 1 + len).toString('ascii'))
    pos += 1 + len
    if (!jumped) end = pos
  }
  return { name: labels.join('.'), end }
}

function parseA(buf, qname) {
  if (buf.length < 12) return null
  const qd = buf.readUInt16BE(4)
  const an = buf.readUInt16BE(6)
  let off = 12
  for (let i = 0; i < qd; i++) {
    const n = readName(buf, off)
    off = n.end + 4
  }
  const want = qname.replace(/\.$/, '').toLowerCase()
  for (let i = 0; i < an; i++) {
    if (off + 10 > buf.length) break
    const n = readName(buf, off)
    off = n.end
    const type = buf.readUInt16BE(off)
    off += 8
    const rdlen = buf.readUInt16BE(off)
    off += 2
    if (type === 1 && rdlen === 4) {
      const got = n.name.replace(/\.$/, '').toLowerCase()
      if (got === want || got.endsWith('.' + want) || want.endsWith('.' + got)) {
        return `${buf[off]}.${buf[off + 1]}.${buf[off + 2]}.${buf[off + 3]}`
      }
    }
    off += rdlen
  }
  return null
}

function mdnsQuery(hostname, timeoutMs = 1800) {
  return new Promise((resolve) => {
    const qname = String(hostname).replace(/\.$/, '')
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const header = Buffer.alloc(12)
    header.writeUInt16BE(1, 4)
    const q = Buffer.alloc(4)
    q.writeUInt16BE(1, 0)
    q.writeUInt16BE(1, 2)
    const query = Buffer.concat([header, encodeName(qname), q])
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sock.close() } catch { /* */ }
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    sock.on('message', (msg) => {
      try {
        const ip = parseA(msg, qname)
        if (ip) finish(ip)
      } catch { /* */ }
    })
    sock.on('error', () => finish(null))
    sock.bind(0, () => {
      try { sock.setMulticastTTL(1) } catch { /* */ }
      sock.send(query, 5353, '224.0.0.251', (err) => {
        if (err) finish(null)
      })
    })
  })
}


function winLookup(host) {
  return new Promise((resolve) => {
    const cmd = "try { ([System.Net.Dns]::GetHostAddresses('" + host.replace(/'/g, "") + "') | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).IPAddressToString } catch { '' }"
    execFile('powershell.exe', ['-NoProfile', '-Command', cmd], { timeout: 2500 }, (err, stdout) => {
      const ip = String(stdout || '').trim()
      resolve(/^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null)
    })
  })
}

const cache = new Map()

export async function resolveHost(hostname) {
  const host = String(hostname || '').trim().replace(/\.$/, '')
  if (!host) return null
  if (net.isIP(host)) return host
  const hit = cache.get(host)
  if (hit && Date.now() - hit.at < 60_000) return hit.ip
  try {
    const a = await dns.lookup(host, { family: 4 })
    if (a?.address) {
      cache.set(host, { ip: a.address, at: Date.now() })
      return a.address
    }
  } catch { /* */ }
  if (process.platform === 'win32') {
    const ip = await winLookup(host)
    if (ip) {
      cache.set(host, { ip, at: Date.now() })
      return ip
    }
  }
  if (host.endsWith('.local')) {
    const ip = await mdnsQuery(host)
    if (ip) {
      cache.set(host, { ip, at: Date.now() })
      return ip
    }
  }
  return null
}

export async function resolveUrlHost(url) {
  try {
    const u = new URL(url)
    if (net.isIP(u.hostname)) return url
    const ip = await resolveHost(u.hostname)
    if (!ip) return url
    u.hostname = ip
    return u.toString()
  } catch {
    return url
  }
}
