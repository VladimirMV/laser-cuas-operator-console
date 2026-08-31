/**
 * Laser C-UAS media side-car 1.8.1
 * Always-on 90 s ring + session H.265/H.264 segments on workstation NVMe.
 *
 * Env: SIDECAR_PORT, SIDECAR_HOST, MEDIA_ROOT, FFMPEG_PATH,
 *      STREAM_LONG, STREAM_WIDE, STREAM_IR
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { resolveUrlHost } from './mdns.mjs'
import { discoverPanoptes } from './discover.mjs'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const configPath = path.join(__dirname, 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

const HOST = process.env.SIDECAR_HOST || config.host || '127.0.0.1'
const PORT = Number(process.env.SIDECAR_PORT || config.port || 8787)
const MEDIA_ROOT = path.resolve(__dirname, process.env.MEDIA_ROOT || config.mediaRoot || './media')
const MAPS_ROOT = path.resolve(__dirname, process.env.MAPS_ROOT || config.mapsRoot || './maps/tiles')
const RING_SEG = Number(config.ringSegmentSec || 6)
const RING_WRAP = Number(config.ringWrap || 15)
const DEFAULT_PREROLL = Number(config.prerollSec || 15)
const CHANNELS = ['LONG', 'WIDE', 'IR']
const CORS = {
  'Access-Control-Allow-Origin': config.corsOrigin || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Range',
  'Access-Control-Expose-Headers': 'Accept-Ranges,Content-Range,Content-Length',
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}
function ffPath(p) {
  return p.replace(/\\/g, '/')
}

function resolveFfmpegBin() {
  const env = (process.env.FFMPEG_PATH || '').trim()
  if (env && fs.existsSync(env)) return env
  const configured = (config.ffmpegPath || '').trim()
  if (configured && configured !== 'ffmpeg' && fs.existsSync(configured)) return configured
  try {
    const packed = require('ffmpeg-static')
    if (packed && fs.existsSync(packed)) return packed
  } catch {
    /* optional */
  }
  return configured || 'ffmpeg'
}

function probeFfmpeg(bin) {
  try {
    const out = execFileSync(bin, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    })
    return {
      ok: true,
      bin,
      h265: /libx265|hevc_nvenc|hevc_qsv|hevc_vaapi/.test(out),
      h264: /libx264|h264_nvenc/.test(out),
      hwAccel: /hevc_nvenc|hevc_qsv|hevc_vaapi|h264_nvenc/.test(out),
    }
  } catch {
    return { ok: false, bin, h265: false, h264: false, hwAccel: false }
  }
}

const ffmpegBin = resolveFfmpegBin()
const ffmpegInfo = probeFfmpeg(ffmpegBin)

function pickEncoder(codec) {
  const preferHw = !!config.preferHw
  if (codec === 'h265') {
    if (preferHw && /hevc_nvenc/.test(config.hwEncoder || '') && ffmpegInfo.hwAccel)
      return { enc: 'hevc_nvenc', codecName: 'h265', hw: true }
    if (ffmpegInfo.h265) return { enc: 'libx265', codecName: 'h265', hw: false }
    if (ffmpegInfo.h264) return { enc: 'libx264', codecName: 'h264', hw: false }
    return null
  }
  if (ffmpegInfo.h264) return { enc: 'libx264', codecName: 'h264', hw: false }
  if (ffmpegInfo.h265) return { enc: 'libx265', codecName: 'h265', hw: false }
  return null
}

const FORCE_TESTSRC = process.env.FORCE_TESTSRC === '1'
const BUILTIN_STREAMS = {
  LONG: 'http://panoptes-base.local/2k-stream',
  IR: 'http://panoptes.local/thermal/stream',
  WIDE: '',
}

function channelKind(ch) {
  const cfg = config.channels?.[ch] || {}
  if ((cfg.kind || '').toLowerCase() === 'none' && ch === 'WIDE') return 'none'
  if (FORCE_TESTSRC) return 'testsrc'
  const url = channelUrl(ch)
  if (!url) return 'none'
  if (url.startsWith('rtsp://')) return 'rtsp'
  if (/\.(mp4|mkv|mov|m3u8|ts)(\?|$)/i.test(url)) return 'file'
  if (/^https?:/i.test(url)) return 'mjpeg'
  return 'none'
}

function channelUrl(ch) {
  const envVal = (process.env[`STREAM_${ch}`] || '').trim()
  const cfg = config.channels?.[ch] || {}
  if (ch === 'WIDE' && (cfg.kind || '').toLowerCase() === 'none' && !envVal) return ''
  if (FORCE_TESTSRC) return ''
  if (envVal && envVal !== 'testsrc') return envVal
  const primary = (cfg.url || '').trim()
  if (primary && primary !== 'testsrc') return primary
  const fb = (cfg.fallback || '').trim()
  if (fb && fb !== 'testsrc') return fb
  return BUILTIN_STREAMS[ch] || ''
}

function sessionDir(sessionId) {
  return path.join(MEDIA_ROOT, sessionId)
}
function channelDir(sessionId, ch) {
  return path.join(sessionDir(sessionId), 'media', ch.toLowerCase())
}
function ringDir(ch) {
  return path.join(MEDIA_ROOT, 'ring', ch.toLowerCase())
}
function appendIndex(sessionId, row) {
  ensureDir(sessionDir(sessionId))
  fs.appendFileSync(path.join(sessionDir(sessionId), 'media_index.jsonl'), JSON.stringify(row) + '\n')
}

function geometry(ch) {
  if (ch === 'LONG') return { size: '1920x1080', w: 1920, h: 1080, fps: 30 }
  if (ch === 'WIDE') return { size: '1280x720', w: 1280, h: 720, fps: 30 }
  return { size: '640x512', w: 640, h: 512, fps: 30 }
}

const resolvedUrls = Object.create(null)

function stillMdns(url) {
  return Boolean(url && /\.local([:/]|$)/i.test(url))
}

async function resolveChannelUrls({ scan = false } = {}) {
  for (const ch of CHANNELS) {
    const url = channelUrl(ch)
    if (!url) {
      resolvedUrls[ch] = ''
      continue
    }
    const next = await resolveUrlHost(url)
    resolvedUrls[ch] = next
    if (next !== url) console.log(`[sidecar] DNS ${ch}: ${url} → ${next}`)
  }
  const need = CHANNELS.filter((ch) => ch !== 'WIDE' && stillMdns(liveUrl(ch)))
  if (!need.length) return resolvedUrls
  console.log(`[sidecar] ${need.join(',')} still *.local — ARP/HTTP discover scan=${scan}`)
  try {
    const found = await discoverPanoptes({ scan })
    if (found.LONG && stillMdns(liveUrl('LONG'))) {
      resolvedUrls.LONG = found.LONG
      console.log(`[sidecar] ARP LONG → ${found.LONG}`)
    }
    if (found.IR && stillMdns(liveUrl('IR'))) {
      resolvedUrls.IR = found.IR
      console.log(`[sidecar] ARP IR → ${found.IR}`)
    }
  } catch (e) {
    console.warn('[sidecar] discover failed', e.message || e)
  }
  return resolvedUrls
}

function liveUrl(ch) {
  if (resolvedUrls[ch]) return resolvedUrls[ch]
  return channelUrl(ch)
}

function inputArgs(ch) {
  const url = liveUrl(ch)
  const kind = channelKind(ch)
  const g = geometry(ch)
  if (kind === 'none' || !url) {
    if (FORCE_TESTSRC) {
      return {
        args: ['-f', 'lavfi', '-i', `testsrc=size=${g.size}:rate=${g.fps}`],
        fromUrl: null,
        kind: 'testsrc',
      }
    }
    return { args: null, fromUrl: null, kind: 'none' }
  }
  if (kind === 'rtsp') {
    return { args: ['-rtsp_transport', 'tcp', '-i', url], fromUrl: url, kind }
  }
  if (kind === 'mjpeg') {
    return {
      args: [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '4',
        '-fflags', '+genpts+discardcorrupt',
        '-use_wallclock_as_timestamps', '1',
        '-i', url,
      ],
      fromUrl: url,
      kind,
    }
  }
  const args = []
  if (/\.(mp4|mkv|mov|ts|m3u8)(\?|$)/i.test(url)) args.push('-stream_loop', '-1', '-re')
  args.push('-i', url)
  return { args, fromUrl: url, kind }
}

function videoEncodeArgs(encoder, bitrateKbps, gop) {
  if (encoder.enc === 'libx265') {
    return [
      '-c:v', 'libx265', '-preset', 'veryfast',
      '-x265-params', `keyint=${gop}:min-keyint=${gop}:scenecut=0`,
      '-b:v', `${bitrateKbps}k`, '-pix_fmt', 'yuv420p',
    ]
  }
  if (encoder.enc === 'hevc_nvenc') {
    return ['-c:v', 'hevc_nvenc', '-preset', 'p4', '-b:v', `${bitrateKbps}k`, '-pix_fmt', 'yuv420p', '-g', String(gop)]
  }
  return [
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
    '-b:v', `${bitrateKbps}k`, '-pix_fmt', 'yuv420p', '-g', String(gop),
  ]
}

function spawnLogged(bin, args, tag) {
  const proc = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  proc.stderr.on('data', (d) => {
    const s = d.toString().trim()
    if (s) console.log(`[ffmpeg:${tag}] ${s}`)
  })
  proc.on('exit', (code, signal) => {
    console.log(`[sidecar] ${tag} exited code=${code} signal=${signal}`)
  })
  return proc
}

/** @type {Record<string, import('node:child_process').ChildProcess>} */
const ringProcs = {}
let ringHot = false

function stopRing() {
  for (const ch of CHANNELS) {
    try { ringProcs[ch]?.kill('SIGKILL') } catch { /* */ }
    delete ringProcs[ch]
  }
  ringHot = false
}

async function refreshAndRing({ scan = false } = {}) {
  await resolveChannelUrls({ scan })
  const ready = CHANNELS.filter((ch) => ch !== 'WIDE' && liveUrl(ch) && !stillMdns(liveUrl(ch)))
  if (!ready.length) {
    console.warn('[sidecar] camera IP not found yet — ring idle. Keep HMI open (ARP) or set IP in config.json')
    return false
  }
  const already = ready.every((ch) => ringProcs[ch] && ringProcs[ch].exitCode == null)
  if (already && ringHot) return true
  stopRing()
  startRing()
  return ringHot
}

function startRing() {
  const enc = pickEncoder('h264') || pickEncoder('h265')
  if (!ffmpegInfo.ok || !enc) {
    console.warn('[sidecar] ring not started — FFmpeg encoder missing')
    ringHot = false
    return
  }
  for (const ch of CHANNELS) {
    const dir = ringDir(ch)
    ensureDir(dir)
    const pattern = ffPath(path.join(dir, 'r_%02d.mp4'))
    const { args: inArgs, fromUrl, kind } = inputArgs(ch)
    if (!inArgs) {
      console.log(`[sidecar] ring ${ch} skipped (not fitted)`)
      continue
    }
    if (fromUrl && stillMdns(fromUrl)) {
      console.log(`[sidecar] ring ${ch} waiting for IP (${fromUrl})`)
      continue
    }
    if (kind === 'testsrc' && !FORCE_TESTSRC) {
      console.log(`[sidecar] ring ${ch} refused testsrc`)
      continue
    }
    const gop = RING_SEG * geometry(ch).fps
    const br = Math.round((config.bitratesKbps?.[ch] ?? 3000) * 0.5)
    const args = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      ...inArgs,
      '-map', '0:v:0', '-an',
      ...videoEncodeArgs({ enc: 'libx264', codecName: 'h264', hw: false }, br, gop),
      '-f', 'segment',
      '-segment_time', String(RING_SEG),
      '-segment_wrap', String(RING_WRAP),
      '-reset_timestamps', '1',
      '-segment_format_options', 'movflags=frag_keyframe+empty_moov+default_base_moof',
      pattern,
    ]
    console.log(`[sidecar] ring ${ch} ← ${fromUrl || kind} → ${dir}`)
    ringProcs[ch] = spawnLogged(ffmpegBin, args, `ring:${ch}`)
  }
  const fitted = CHANNELS.filter((c) => ringProcs[c])
  ringHot = fitted.length > 0 && fitted.every((ch) => ringProcs[ch] && !ringProcs[ch].killed)
  for (const ch of fitted) {
    ringProcs[ch]?.on('exit', () => {
      ringHot = fitted.every((c) => ringProcs[c] && ringProcs[c].exitCode == null && !ringProcs[c].killed)
    })
  }
}

function listRingFiles(ch) {
  const dir = ringDir(ch)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4'))
    .map((f) => {
      const p = path.join(dir, f)
      const st = fs.statSync(p)
      return { file: f, path: p, mtime: st.mtimeMs, size: st.size }
    })
    .filter((x) => x.size > 1024)
    .sort((a, b) => a.mtime - b.mtime)
}

function copyPreroll(sessionId, channels, prerollSec) {
  const n = Math.max(1, Math.ceil(Number(prerollSec || DEFAULT_PREROLL) / RING_SEG))
  const refs = []
  const t0 = Date.now()
  for (const ch of channels) {
    const files = listRingFiles(ch)
    const closed = files.length > 1 ? files.slice(0, -1) : files
    const take = closed.slice(-n)
    const dest = path.join(channelDir(sessionId, ch), 'preroll')
    ensureDir(dest)
    take.forEach((item, i) => {
      const t = i * RING_SEG * 1000
      const name = `preroll_${String(i).padStart(2, '0')}_t${String(t).padStart(6, '0')}.mp4`
      const to = path.join(dest, name)
      try {
        fs.copyFileSync(item.path, to)
      } catch (e) {
        console.warn(`[sidecar] preroll copy ${ch}: ${e.message}`)
        return
      }
      const rel = path.relative(MEDIA_ROOT, to).replace(/\\/g, '/')
      const ref = {
        id: `MED-pre-${ch}-${i}-${t0}`,
        ts_utc: new Date(t0).toISOString(),
        t_mono_ms: t,
        session_id: sessionId,
        channel: ch,
        kind: 'SEGMENT',
        label: `PREROLL ${ch} −${prerollSec}s from ring`,
        codec: 'h264',
        container: 'mp4',
        duration_ms: RING_SEG * 1000,
        path: rel,
        url: `/media/${rel}`,
      }
      refs.push(ref)
      appendIndex(sessionId, ref)
    })
  }
  return refs
}

function renameSegmentsWithMono(sessionId, ch, codecName, segmentDurationSec) {
  const dir = channelDir(sessionId, ch)
  if (!fs.existsSync(dir)) return []
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mp4') && (f.startsWith('seg_') || f.startsWith('rec_live_')))
    .sort()
  const out = []
  for (let idx = 0; idx < files.length; idx++) {
    const f = files[idx]
    const m = f.match(/^seg_(\d+)/)
    const i = m ? Number(m[1]) : idx
    const t = i * Number(segmentDurationSec || 15) * 1000
    const tPad = String(Math.floor(t)).padStart(6, '0')
    const next = `seg_${String(i).padStart(4, '0')}_t${tPad}_${codecName}.mp4`
    const from = path.join(dir, f)
    const to = path.join(dir, next)
    if (from !== to) {
      try {
        if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to)
      } catch {
        /* keep */
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

ensureDir(MEDIA_ROOT)
ensureDir(MAPS_ROOT)
for (const ch of CHANNELS) ensureDir(ringDir(ch))

/** @type {null | object} */
let recording = null
/** @type {import('node:child_process').ChildProcess[]} */
let ffmpegProcs = []

function getCaps() {
  return {
    ok: ffmpegInfo.ok,
    h265: ffmpegInfo.h265,
    h264: ffmpegInfo.h264,
    hwAccel: ffmpegInfo.hwAccel,
    maxChannels: 3,
    metaOnly: false,
    ffmpeg: ffmpegInfo.ok,
    ffmpegBin,
    mediaRoot: MEDIA_ROOT,
    ringHot,
    prerollSec: DEFAULT_PREROLL,
    ringSeconds: RING_SEG * RING_WRAP,
    channelsConfigured: Object.fromEntries(CHANNELS.map((ch) => [ch, Boolean(channelUrl(ch))])),
  }
}

function diskBytes() {
  let n = 0
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else n += fs.statSync(p).size
    }
  }
  walk(MEDIA_ROOT)
  return n
}

async function handleStart(body) {
  if (recording) return { ok: false, message: 'Already recording', sessionId: recording.sessionId }
  if (!ffmpegInfo.ok) return { ok: false, message: 'FFmpeg not available on side-car host' }
  await resolveChannelUrls({ scan: true })
  if (!ringHot) startRing()

  const sessionId = String(body.sessionId || `SES-${Date.now()}`)
  let channels = Array.isArray(body.channels) ? body.channels.map(String) : ['LONG', 'IR']
  channels = channels.filter((c) => CHANNELS.includes(c))
  if (!channels.length) return { ok: false, message: 'No valid channels' }

  const wantCodec = body.codec === 'h264' ? 'h264' : 'h265'
  const encoder = pickEncoder(wantCodec)
  if (!encoder) return { ok: false, message: 'No suitable video encoder' }

  for (const ch of channels) {
    const u = liveUrl(ch)
    if (u && /\.local([:/]|$)/i.test(u)) {
      return {
        ok: false,
        message: 'Cannot resolve ' + u + ' (Windows mDNS). Put camera IP in sidecar/config.json, e.g. http://192.168.1.20/2k-stream',
      }
    }
  }

  const segmentDurationSec = Number(body.segmentDurationSec || config.segmentDurationSec || 15)
  const prerollSec = Number(body.prerollSec || DEFAULT_PREROLL)
  const bitrates = {
    LONG: config.bitratesKbps?.LONG ?? 6000,
    WIDE: config.bitratesKbps?.WIDE ?? 3000,
    IR: config.bitratesKbps?.IR ?? 2000,
    ...(body.bitrates || {}),
  }

  ensureDir(sessionDir(sessionId))
  ensureDir(path.join(sessionDir(sessionId), 'media', 'snapshots'))
  ensureDir(path.join(sessionDir(sessionId), 'media', 'clips'))

  const prerollRefs = copyPreroll(sessionId, channels, prerollSec)

  ffmpegProcs = []
  const refs = [...prerollRefs]
  const t0 = Date.now()

  for (const ch of channels) {
    const br = bitrates[ch] || 3000
    const outDir = channelDir(sessionId, ch)
    ensureDir(outDir)
    const outFile = ffPath(path.join(outDir, `rec_live_${encoder.codecName}.mp4`))
    const { args: inArgs, fromUrl, kind } = inputArgs(ch)
    if (!inArgs) {
      console.log(`[sidecar] REC ${ch} skipped (not fitted)`)
      continue
    }
    const gop = Math.max(geometry(ch).fps, 2 * geometry(ch).fps)
    const args = [
      '-y', '-hide_banner', '-loglevel', 'warning',
      ...inArgs,
      '-map', '0:v:0', '-an',
      ...videoEncodeArgs(encoder, br, gop),
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      outFile,
    ]
    console.log(`[sidecar] REC ${ch} ← ${fromUrl || kind} → ${outDir} (${encoder.enc} ${br}k)`)
    ffmpegProcs.push(spawnLogged(ffmpegBin, args, ch))
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
      path: path.relative(MEDIA_ROOT, outDir).replace(/\\/g, '/'),
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
    prerollSec,
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
    prerollCopied: prerollRefs.length,
    refs,
  }
}

async function handleStop() {
  if (!recording) return { ok: false, message: 'Not recording', refs: [] }
  const snap = recording
  for (const p of ffmpegProcs) {
    try {
      p.stdin?.write('q')
      p.stdin?.end()
    } catch { /* */ }
  }
  await new Promise((r) => setTimeout(r, 2500))
  for (const p of ffmpegProcs) {
    try { if (!p.killed && p.exitCode == null) p.kill('SIGKILL') } catch { /* */ }
  }
  ffmpegProcs = []

  const files = []
  for (const ch of snap.channels) {
    for (const seg of renameSegmentsWithMono(snap.sessionId, ch, snap.actualCodec, snap.segmentDurationSec)) {
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
    mediaRoot: MEDIA_ROOT,
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
  const { args: inArgs } = inputArgs(ch)
  if (!inArgs) return { ok: false, message: `channel ${ch} not fitted` }
  const args = ['-y', '-hide_banner', '-loglevel', 'error', ...inArgs, '-frames:v', '1', '-q:v', '2', outFile]
  try {
    execFileSync(ffmpegBin, args, { timeout: 20000 })
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

async function handleClip(body) {
  const sessionId = String(body.sessionId || '')
  const ch = String(body.channel || 'LONG')
  if (!sessionId) return { ok: false, message: 'sessionId required' }
  if (!CHANNELS.includes(ch)) return { ok: false, message: 'Bad channel' }
  const tStart = Math.max(0, Number(body.tStartMs || 0))
  const tEnd = Math.max(tStart + 500, Number(body.tEndMs || tStart + 40_000))
  const dir = channelDir(sessionId, ch)
  const prerollDir = path.join(dir, 'preroll')
  const files = []
  if (fs.existsSync(prerollDir)) {
    for (const f of fs.readdirSync(prerollDir).filter((x) => x.endsWith('.mp4')).sort()) {
      files.push(path.join(prerollDir, f))
    }
  }
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.mp4') && x.startsWith('seg_')).sort()) {
      files.push(path.join(dir, f))
    }
  }
  if (!files.length) return { ok: false, message: 'No segments to cut' }

  const clipDir = path.join(sessionDir(sessionId), 'media', 'clips')
  ensureDir(clipDir)
  const label = String(body.label || `ENG_T-${Math.round(tStart / 1000)}_T+${Math.round(tEnd / 1000)}_${ch.toLowerCase()}`)
  const safe = label.replace(/[^\w.\-+]+/g, '_')
  const outFile = path.join(clipDir, `${safe}.mp4`)
  const listFile = path.join(clipDir, `${safe}.txt`)
  fs.writeFileSync(listFile, files.map((f) => `file '${ffPath(f)}'`).join('\n'))

  const ss = (tStart / 1000).toFixed(3)
  const dur = ((tEnd - tStart) / 1000).toFixed(3)
  try {
    await execFileAsync(
      ffmpegBin,
      ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-ss', ss, '-t', dur, '-c', 'copy', outFile],
      { timeout: 60000 }
    )
  } catch (e) {
    try {
      await execFileAsync(
        ffmpegBin,
        ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-ss', ss, '-t', dur, '-c:v', 'libx264', '-an', outFile],
        { timeout: 120000 }
      )
    } catch (e2) {
      return { ok: false, message: `clip failed: ${e2.message}` }
    }
  }
  const rel = path.relative(MEDIA_ROOT, outFile).replace(/\\/g, '/')
  const ref = {
    id: `MED-clip-${Date.now()}`,
    ts_utc: new Date().toISOString(),
    t_mono_ms: tStart,
    session_id: sessionId,
    channel: ch,
    kind: 'CLIP',
    label,
    codec: 'h264',
    container: 'mp4',
    duration_ms: tEnd - tStart,
    path: rel,
    url: `/media/${rel}`,
  }
  appendIndex(sessionId, ref)
  return { ok: true, ref }
}

function listSessions() {
  if (!fs.existsSync(MEDIA_ROOT)) return []
  const out = []
  for (const name of fs.readdirSync(MEDIA_ROOT)) {
    if (name === 'ring') continue
    const dir = path.join(MEDIA_ROOT, name)
    if (!fs.statSync(dir).isDirectory()) continue
    let files = 0
    let bytes = 0
    const walk = (d) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, ent.name)
        if (ent.isDirectory()) walk(p)
        else {
          files++
          bytes += fs.statSync(p).size
        }
      }
    }
    walk(dir)
    out.push({ id: name, files, bytes, path: dir })
  }
  return out.sort((a, b) => b.id.localeCompare(a.id))
}

function serveStatic(req, res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/media\/?/, ''))
  const file = path.normalize(path.join(MEDIA_ROOT, rel))
  if (!file.startsWith(MEDIA_ROOT)) {
    res.writeHead(403, CORS)
    return res.end('Forbidden')
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, CORS)
    return res.end('Not found')
  }
  const st = fs.statSync(file)
  const ext = path.extname(file).toLowerCase()
  const types = {
    '.mp4': 'video/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jsonl': 'application/x-ndjson',
    '.json': 'application/json',
    '.txt': 'text/plain',
  }
  const type = types[ext] || 'application/octet-stream'
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m && m[1] ? Number(m[1]) : 0
    const end = m && m[2] ? Number(m[2]) : st.size - 1
    if (start >= st.size || end >= st.size) {
      res.writeHead(416, { ...CORS, 'Content-Range': `bytes */${st.size}` })
      return res.end()
    }
    res.writeHead(206, {
      ...CORS,
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${st.size}`,
      'Content-Length': end - start + 1,
    })
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, {
    ...CORS,
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Content-Length': st.size,
  })
  fs.createReadStream(file).pipe(res)
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
  const method = req.method || 'GET'
  if (method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  try {
    if (method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'laser-cuas-media-sidecar', version: '1.8.1', ffmpeg: ffmpegInfo.ok, ringHot })
    }
    if (method === 'GET' && url.pathname === '/caps') return json(res, 200, getCaps())
    if (method === 'GET' && url.pathname === '/status') {
      return json(res, 200, {
        recording: Boolean(recording),
        ringHot,
        mediaRoot: MEDIA_ROOT,
        diskBytes: diskBytes(),
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
        streams: Object.fromEntries(CHANNELS.map((ch) => [ch, liveUrl(ch) || null])),
        ring: Object.fromEntries(
          CHANNELS.map((ch) => [ch, { files: listRingFiles(ch).length, dir: ringDir(ch) }])
        ),
      })
    }
    if (method === 'GET' && url.pathname === '/sessions') {
      return json(res, 200, { ok: true, mediaRoot: MEDIA_ROOT, sessions: listSessions() })
    }
    if (method === 'POST' && url.pathname === '/discover') {
      const body = await readBody(req).catch(() => ({}))
      const ok = await refreshAndRing({ scan: Boolean(body && body.scan) })
      return json(res, 200, { ok, ringHot, streams: Object.fromEntries(CHANNELS.map((ch) => [ch, liveUrl(ch) || null])) })
    }
    if (method === 'POST' && url.pathname === '/record/start') {
      const result = await handleStart(await readBody(req))
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'POST' && url.pathname === '/record/stop') {
      const result = await handleStop()
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'POST' && url.pathname === '/snapshot') {
      const result = await handleSnapshot(await readBody(req))
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'POST' && url.pathname === '/clip') {
      const result = await handleClip(await readBody(req))
      return json(res, result.ok ? 200 : 400, result)
    }
    if (method === 'GET' && url.pathname === '/map/status') {
      let files = 0
      const walk = (d) => {
        if (!fs.existsSync(d)) return
        for (const n of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, n.name)
          if (n.isDirectory()) walk(p)
          else if (/\.(png|jpg|webp)$/i.test(n.name)) files++
        }
      }
      walk(MAPS_ROOT)
      return json(res, 200, { ok: true, offline: files > 0, tiles: files, root: MAPS_ROOT, urlTemplate: '/map/tiles/{z}/{x}/{y}.png' })
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
        res.writeHead(404, CORS)
        return res.end()
      }
      res.writeHead(200, { ...CORS, 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' })
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

function shutdown() {
  console.log('[sidecar] shutting down…')
  for (const p of Object.values(ringProcs)) {
    try { p.kill('SIGKILL') } catch { /* */ }
  }
  for (const p of ffmpegProcs) {
    try { p.kill('SIGKILL') } catch { /* */ }
  }
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.listen(PORT, HOST, () => {
  console.log(`[sidecar] Laser C-UAS media 1.8.1  http://${HOST}:${PORT}`)
  console.log(`[sidecar] mediaRoot=${MEDIA_ROOT}`)
  console.log(`[sidecar] ffmpeg=${ffmpegInfo.ok} bin=${ffmpegBin} h265=${ffmpegInfo.h265} h264=${ffmpegInfo.h264}`)
  for (const ch of CHANNELS) {
    console.log(`[sidecar] ${ch}: ${channelUrl(ch) || channelKind(ch)}`)
  }
  void refreshAndRing({ scan: false }).then((ok) => {
    console.log(`[sidecar] ringHot=${ringHot} started=${ok}`)
  })
  setInterval(() => {
    if (!ringHot && !FORCE_TESTSRC) {
      void refreshAndRing({ scan: false })
    }
  }, 8000)
})
