/**
 * Laser C-UAS media side-car
 * REST control surface for multi-channel H.265/H.264 recording via FFmpeg.
 *
 * GET  /health
 * GET  /caps
 * GET  /status
 * POST /record/start   { sessionId, channels[], codec?, segmentDurationSec?, bitrates? }
 * POST /record/stop
 * POST /snapshot       { channel, triggerEventId?, label? }
 * GET  /media/*        static files under mediaRoot
 *
 * Env overrides:
 *   SIDECAR_PORT, SIDECAR_HOST, MEDIA_ROOT
 *   STREAM_LONG, STREAM_WIDE, STREAM_IR  (RTSP/SRT/HTTP URLs)
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const configPath = path.join(__dirname, 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

const HOST = process.env.SIDECAR_HOST || config.host || '127.0.0.1'
const PORT = Number(process.env.SIDECAR_PORT || config.port || 8787)
const MEDIA_ROOT = path.resolve(
  __dirname,
  process.env.MEDIA_ROOT || config.mediaRoot || './media'
)
const MAPS_ROOT = path.resolve(
  __dirname,
  process.env.MAPS_ROOT || config.mapsRoot || './maps/tiles'
)
ensureDir(MAPS_ROOT)

const CHANNELS = ['LONG', 'WIDE', 'IR']

function channelUrl(ch) {
  const envKey = `STREAM_${ch}`
  if (process.env[envKey]) return process.env[envKey]
  return (config.channels?.[ch]?.url || '').trim()
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

ensureDir(MEDIA_ROOT)
ensureDir(path.join(MEDIA_ROOT, 'ring', 'long'))
ensureDir(path.join(MEDIA_ROOT, 'ring', 'wide'))
ensureDir(path.join(MEDIA_ROOT, 'ring', 'ir'))

/** @type {import('node:child_process').ChildProcess[]} */
let ffmpegProcs = []
let recording = null // { sessionId, channels, codec, actualCodec, startedAt, segmentDurationSec, bitrates, refs[] }
let segCounters = { LONG: 0, WIDE: 0, IR: 0 }

function probeFfmpeg() {
  const bin = config.ffmpegPath || 'ffmpeg'
  try {
    const out = execFileSync(bin, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    const h265 =
      /libx265/.test(out) ||
      /hevc_nvenc/.test(out) ||
      /hevc_qsv/.test(out) ||
      /hevc_vaapi/.test(out)
    const h264 = /libx264/.test(out) || /h264_nvenc/.test(out)
    const hwAccel = /hevc_nvenc|hevc_qsv|hevc_vaapi|h264_nvenc/.test(out)
    return { ok: true, bin, h265, h264, hwAccel }
  } catch {
    return { ok: false, bin, h265: false, h264: false, hwAccel: false }
  }
}

const ffmpegInfo = probeFfmpeg()

function pickEncoder(codec) {
  const preferHw = !!config.preferHw
  if (codec === 'h265') {
    if (preferHw && /hevc_nvenc/.test(config.hwEncoder || '')) return { enc: 'hevc_nvenc', codecName: 'h265', hw: true }
    if (ffmpegInfo.h265) return { enc: 'libx265', codecName: 'h265', hw: false }
    if (ffmpegInfo.h264) return { enc: 'libx264', codecName: 'h264', hw: false }
    return null
  }
  if (ffmpegInfo.h264) return { enc: 'libx264', codecName: 'h264', hw: false }
  if (ffmpegInfo.h265) return { enc: 'libx265', codecName: 'h265', hw: false }
  return null
}

function sessionDir(sessionId) {
  return path.join(MEDIA_ROOT, sessionId)
}

function channelDir(sessionId, ch) {
  return path.join(sessionDir(sessionId), 'media', ch.toLowerCase())
}

function appendIndex(sessionId, row) {
  const dir = sessionDir(sessionId)
  ensureDir(dir)
  const line = JSON.stringify(row) + '\n'
  fs.appendFileSync(path.join(dir, 'media_index.jsonl'), line)
}

function buildFfmpegArgs(ch, sessionId, encoder, bitrateKbps, segmentSec) {
  const url = channelUrl(ch)
  const outDir = channelDir(sessionId, ch)
  ensureDir(outDir)
  const pattern = path.join(outDir, `seg_%04d_${encoder.codecName}.mp4`)

  const args = ['-y', '-hide_banner', '-loglevel', 'warning']

  if (url) {
    if (url.startsWith('rtsp://')) {
      args.push('-rtsp_transport', 'tcp', '-i', url)
    } else {
      args.push('-i', url)
    }
  } else {
    // Lab pattern when no camera URL configured
    const size =
      ch === 'LONG' ? '1920x1080' : ch === 'WIDE' ? '1280x720' : '640x512'
    const rate = '30'
    args.push(
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${size}:rate=${rate}`,
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=mono:sample_rate=48000'
    )
  }

  args.push('-map', '0:v:0')
  if (!url) {
    // no audio in output
  }

  const gop = Math.max(30, Number(segmentSec) * 30)
  if (encoder.enc === 'libx265') {
    args.push(
      '-c:v',
      'libx265',
      '-preset',
      'medium',
      '-x265-params',
      `keyint=${gop}:min-keyint=${gop}:scenecut=0`,
      '-b:v',
      `${bitrateKbps}k`,
      '-pix_fmt',
      'yuv420p'
    )
  } else if (encoder.enc === 'hevc_nvenc') {
    args.push(
      '-c:v',
      'hevc_nvenc',
      '-preset',
      'p4',
      '-b:v',
      `${bitrateKbps}k`,
      '-pix_fmt',
      'yuv420p'
    )
  } else {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-b:v',
      `${bitrateKbps}k`,
      '-pix_fmt',
      'yuv420p',
      '-g',
      String(gop)
    )
  }

  args.push('-an')
  args.push(
    '-f',
    'segment',
    '-segment_time',
    String(segmentSec),
    '-reset_timestamps',
    '1',
    '-strftime',
    '0',
    pattern
  )

  return { args, pattern, outDir }
}

function spawnChannel(ch, sessionId, encoder, bitrateKbps, segmentSec) {
  const { args, outDir } = buildFfmpegArgs(ch, sessionId, encoder, bitrateKbps, segmentSec)
  const bin = ffmpegInfo.bin
  console.log(`[sidecar] start ${ch} → ${outDir} (${encoder.enc} ${bitrateKbps}k)`)
  const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  proc.stderr.on('data', (d) => {
    const s = d.toString().trim()
    if (s) console.log(`[ffmpeg:${ch}] ${s}`)
  })
  proc.on('exit', (code, signal) => {
    console.log(`[sidecar] ${ch} exited code=${code} signal=${signal}`)
  })
  return proc
}

function listNewSegments(sessionId, ch, codecName) {
  const dir = channelDir(sessionId, ch)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => ({
      channel: ch,
      file: f,
      path: path.join(dir, f),
      rel: path.relative(MEDIA_ROOT, path.join(dir, f)).replace(/\\/g, '/'),
      codec: codecName,
    }))
}

/** Rename FFmpeg `seg_%04d_{codec}.mp4` → `seg_{nnnn}_t{mono}_{codec}.mp4` on stop. */
function renameSegmentsWithMono(sessionId, ch, codecName, segmentDurationSec) {
  const dir = channelDir(sessionId, ch)
  if (!fs.existsSync(dir)) return []
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .sort()
  const out = []
  for (let idx = 0; idx < files.length; idx++) {
    const f = files[idx]
    const m = f.match(/^seg_(\d+)/)
    const i = m ? Number(m[1]) : idx
    const t = i * Number(segmentDurationSec || 60) * 1000
    const tPad = String(Math.floor(t)).padStart(6, '0')
    const next = `seg_${String(i).padStart(4, '0')}_t${tPad}_${codecName}.mp4`
    const from = path.join(dir, f)
    const to = path.join(dir, next)
    if (from !== to) {
      try {
        if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to)
      } catch {
        /* keep original name */
      }
    }
    const name = fs.existsSync(to) ? next : f
    out.push({
      channel: ch,
      file: name,
      path: path.join(dir, name),
      rel: path.relative(MEDIA_ROOT, path.join(dir, name)).replace(/\\/g, '/'),
      codec: codecName,
      t_mono_ms: t,
    })
  }
  return out
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': config.corsOrigin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function getCaps() {
  return {
    ok: ffmpegInfo.ok,
    h265: ffmpegInfo.h265,
    h264: ffmpegInfo.h264,
    hwAccel: ffmpegInfo.hwAccel,
    maxChannels: 3,
    metaOnly: false,
    ffmpeg: ffmpegInfo.ok,
    channelsConfigured: Object.fromEntries(
      CHANNELS.map((ch) => [ch, Boolean(channelUrl(ch))])
    ),
    mediaRoot: MEDIA_ROOT,
  }
}

async function handleStart(body) {
  if (recording) {
    return { ok: false, message: 'Already recording', sessionId: recording.sessionId }
  }
  if (!ffmpegInfo.ok) {
    return { ok: false, message: 'FFmpeg not available on side-car host' }
  }

  const sessionId = String(body.sessionId || `SES-${Date.now()}`)
  let channels = Array.isArray(body.channels) ? body.channels.map(String) : ['LONG', 'IR']
  channels = channels.filter((c) => CHANNELS.includes(c))
  if (!channels.length) return { ok: false, message: 'No valid channels' }

  const wantCodec = body.codec === 'h264' ? 'h264' : 'h265'
  const encoder = pickEncoder(wantCodec)
  if (!encoder) return { ok: false, message: 'No suitable video encoder' }

  const segmentDurationSec = Number(body.segmentDurationSec || config.segmentDurationSec || 60)
  const bitrates = {
    LONG: config.bitratesKbps?.LONG ?? 6000,
    WIDE: config.bitratesKbps?.WIDE ?? 3000,
    IR: config.bitratesKbps?.IR ?? 2000,
    ...(body.bitrates || {}),
  }

  ensureDir(sessionDir(sessionId))
  ensureDir(path.join(sessionDir(sessionId), 'media', 'snapshots'))

  segCounters = { LONG: 0, WIDE: 0, IR: 0 }
  ffmpegProcs = []
  const refs = []
  const t0 = Date.now()

  for (const ch of channels) {
    const br = bitrates[ch] || 3000
    const proc = spawnChannel(ch, sessionId, encoder, br, segmentDurationSec)
    ffmpegProcs.push(proc)
    const ref = {
      id: `MED-open-${ch}-${t0}`,
      ts_utc: new Date(t0).toISOString(),
      t_mono_ms: 0,
      session_id: sessionId,
      channel: ch,
      kind: 'SEGMENT',
      label: `SEG ${ch} open · ${encoder.codecName}`,
      codec: encoder.codecName,
      container: 'mp4',
      bitrate_kbps: br,
      hw_encoder: encoder.hw,
      path: path.relative(MEDIA_ROOT, channelDir(sessionId, ch)).replace(/\\/g, '/'),
    }
    refs.push(ref)
    appendIndex(sessionId, ref)
  }

  recording = {
    sessionId,
    channels,
    codec: wantCodec,
    actualCodec: encoder.codecName,
    encoder: encoder.enc,
    startedAt: t0,
    segmentDurationSec,
    bitrates,
    refs,
  }

  return {
    ok: true,
    sessionId,
    channels,
    codec_target: wantCodec,
    codec_actual: encoder.codecName,
    encoder: encoder.enc,
    mediaRoot: MEDIA_ROOT,
    refs,
  }
}

async function handleStop() {
  if (!recording) return { ok: false, message: 'Not recording', refs: [] }

  const snap = recording
  for (const p of ffmpegProcs) {
    try {
      p.kill('SIGINT')
    } catch {
      /* */
    }
  }
  // Wait briefly for flush
  await new Promise((r) => setTimeout(r, 800))
  for (const p of ffmpegProcs) {
    try {
      if (!p.killed) p.kill('SIGKILL')
    } catch {
      /* */
    }
  }
  ffmpegProcs = []

  const files = []
  for (const ch of snap.channels) {
    for (const seg of renameSegmentsWithMono(
      snap.sessionId,
      ch,
      snap.actualCodec,
      snap.segmentDurationSec
    )) {
      const ref = {
        id: `MED-seg-${ch}-${path.basename(seg.file)}`,
        ts_utc: new Date().toISOString(),
        t_mono_ms: seg.t_mono_ms ?? Date.now() - snap.startedAt,
        session_id: snap.sessionId,
        channel: ch,
        kind: 'SEGMENT',
        label: seg.file,
        codec: snap.actualCodec,
        container: 'mp4',
        path: seg.rel,
        url: `/media/${seg.rel}`,
      }
      files.push(ref)
      appendIndex(snap.sessionId, ref)
    }
  }

  recording = null
  return {
    ok: true,
    sessionId: snap.sessionId,
    refs: files,
    durationMs: Date.now() - snap.startedAt,
  }
}

async function handleSnapshot(body) {
  const ch = String(body.channel || 'LONG')
  if (!CHANNELS.includes(ch)) return { ok: false, message: 'Bad channel' }

  const sessionId = recording?.sessionId || String(body.sessionId || 'SNAPSHOT')
  const snapDir = path.join(sessionDir(sessionId), 'media', 'snapshots')
  ensureDir(snapDir)
  const mono = recording ? Date.now() - recording.startedAt : 0
  const name = `${mono}_${body.triggerEventId || 'SNAP'}_${ch}.jpg`
  const outFile = path.join(snapDir, name)

  const url = channelUrl(ch)
  const bin = ffmpegInfo.bin
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  if (url) {
    if (url.startsWith('rtsp://')) args.push('-rtsp_transport', 'tcp')
    args.push('-i', url, '-frames:v', '1', '-q:v', '2', outFile)
  } else {
    const size = ch === 'LONG' ? '1920x1080' : ch === 'WIDE' ? '1280x720' : '640x512'
    args.push('-f', 'lavfi', '-i', `testsrc=size=${size}:rate=1`, '-frames:v', '1', '-q:v', '2', outFile)
  }

  try {
    execFileSync(bin, args, { timeout: 15000 })
  } catch (e) {
    return { ok: false, message: `snapshot failed: ${e.message}` }
  }

  const rel = path.relative(MEDIA_ROOT, outFile).replace(/\\/g, '/')
  const ref = {
    id: `MED-snap-${Date.now()}`,
    ts_utc: new Date().toISOString(),
    t_mono_ms: mono,
    session_id: sessionId,
    channel: ch,
    kind: 'SNAPSHOT',
    label: body.label || `SNAPSHOT ${ch}`,
    trigger_event_id: body.triggerEventId,
    codec: 'jpeg',
    container: 'none',
    path: rel,
    url: `/media/${rel}`,
  }
  appendIndex(sessionId, ref)
  return { ok: true, ref }
}

function serveStatic(req, res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/media\/?/, ''))
  const file = path.join(MEDIA_ROOT, rel)
  if (!file.startsWith(MEDIA_ROOT)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404)
    return res.end('Not found')
  }
  const ext = path.extname(file).toLowerCase()
  const types = {
    '.mp4': 'video/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jsonl': 'application/x-ndjson',
    '.json': 'application/json',
  }
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': config.corsOrigin || '*',
  })
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
  const method = req.method || 'GET'

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': config.corsOrigin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  try {
    if (method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'laser-cuas-media-sidecar', ffmpeg: ffmpegInfo.ok })
    }
    if (method === 'GET' && url.pathname === '/caps') {
      return json(res, 200, getCaps())
    }
    if (method === 'GET' && url.pathname === '/status') {
      return json(res, 200, {
        recording: Boolean(recording),
        session: recording
          ? {
              sessionId: recording.sessionId,
              channels: recording.channels,
              codec_actual: recording.actualCodec,
              encoder: recording.encoder,
              startedAt: new Date(recording.startedAt).toISOString(),
              elapsedMs: Date.now() - recording.startedAt,
            }
          : null,
      })
    }
    if (method === 'POST' && url.pathname === '/record/start') {
      const body = await readBody(req)
      const result = await handleStart(body)
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'POST' && url.pathname === '/record/stop') {
      const result = await handleStop()
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'POST' && url.pathname === '/snapshot') {
      const body = await readBody(req)
      const result = await handleSnapshot(body)
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'GET' && url.pathname === '/map/status') {
      let files = 0
      const walk = (d) => {
        if (!fs.existsSync(d)) return
        for (const n of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, n.name)
          if (n.isDirectory()) walk(p)
          else if (/\.png$/i.test(n.name) || /\.jpg$/i.test(n.name) || /\.webp$/i.test(n.name)) files++
        }
      }
      walk(MAPS_ROOT)
      return json(res, 200, {
        ok: true,
        offline: files > 0,
        tiles: files,
        root: MAPS_ROOT,
        urlTemplate: '/map/tiles/{z}/{x}/{y}.png',
      })
    }
    if (method === 'GET' && url.pathname.startsWith('/map/tiles/')) {
      const parts = url.pathname.replace('/map/tiles/', '').split('/')
      const z = parts[0]
      const x = parts[1]
      const y = (parts[2] || '').replace(/\.png$/i, '')
      if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        return json(res, 400, { ok: false, message: 'Bad tile path' })
      }
      const file = path.join(MAPS_ROOT, z, x, `${y}.png`)
      if (!file.startsWith(MAPS_ROOT) || !fs.existsSync(file)) {
        res.writeHead(404, { 'Access-Control-Allow-Origin': config.corsOrigin || '*' })
        return res.end()
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': config.corsOrigin || '*',
      })
      return fs.createReadStream(file).pipe(res)
    }
    if (method === 'GET' && url.pathname.startsWith('/media/')) {
      return serveStatic(req, res, url.pathname)
    }

    json(res, 404, { ok: false, message: 'Not found' })
  } catch (e) {
    console.error(e)
    json(res, 500, { ok: false, message: String(e.message || e) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[sidecar] Laser C-UAS media side-car on http://${HOST}:${PORT}`)
  console.log(`[sidecar] mediaRoot=${MEDIA_ROOT}`)
  console.log(`[sidecar] mapsRoot=${MAPS_ROOT}`)
  console.log(
    `[sidecar] ffmpeg=${ffmpegInfo.ok} h265=${ffmpegInfo.h265} h264=${ffmpegInfo.h264}`
  )
  for (const ch of CHANNELS) {
    const u = channelUrl(ch)
    console.log(`[sidecar] ${ch}: ${u || '(testsrc lab pattern)'}`)
  }
})

function shutdown() {
  console.log('[sidecar] shutting down…')
  for (const p of ffmpegProcs) {
    try {
      p.kill('SIGKILL')
    } catch {
      /* */
    }
  }
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
