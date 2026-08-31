/**
 * Multi-channel media recorder contracts.
 * Production: workstation sidecar writes real H.265/H.264 files.
 * Demo fallback: MockMediaRecorder (index only).
 */

import type { CameraChannel } from '../types/hmi'
import type { MediaCodec, MediaRef } from '../types/archive'
import { archiveMock } from './archive'

export interface MediaRecorderCaps {
  h265: boolean
  h264: boolean
  hwAccel: boolean
  maxChannels: number
  metaOnly: boolean
  ffmpeg?: boolean
  mediaRoot?: string
  ringHot?: boolean
}

export interface SidecarStatus {
  recording: boolean
  ringHot: boolean
  mediaRoot: string
  diskBytes: number
  session: {
    sessionId: string
    channels: CameraChannel[]
    codec_actual: string
    elapsedMs: number
  } | null
}

export interface MediaRecorderStartOpts {
  sessionId: string
  channels: CameraChannel[]
  codec: 'h265' | 'h264'
  segmentDurationSec: number
  bitrates?: Partial<Record<CameraChannel, number>>
  prerollSec?: number
}

export interface IMediaRecorder {
  getCaps(): MediaRecorderCaps
  start(opts: MediaRecorderStartOpts): Promise<void>
  stop(): Promise<MediaRef[]>
  snapshot(channel: CameraChannel, triggerEventId?: string, label?: string): Promise<MediaRef | null>
  tickSegment?(): MediaRef[]
  isActive(): boolean
  getActiveChannels(): CameraChannel[]
  getActualCodec(): MediaCodec
  clip?(opts: { sessionId: string; channel: CameraChannel; tStartMs: number; tEndMs: number; label?: string }): Promise<MediaRef | null>
}

const DEFAULT_BITRATES: Record<CameraChannel, number> = {
  LONG: 6000,
  WIDE: 3000,
  IR: 2000,
}

const RES: Record<CameraChannel, { w: number; h: number; fps: number }> = {
  LONG: { w: 1920, h: 1080, fps: 30 },
  WIDE: { w: 1280, h: 720, fps: 30 },
  IR: { w: 640, h: 512, fps: 30 },
}

export class MockMediaRecorder implements IMediaRecorder {
  private active = false
  private sessionId: string | null = null
  private channels: CameraChannel[] = []
  private targetCodec: 'h265' | 'h264' = 'h265'
  private segmentDurationSec = 60
  private bitrates = { ...DEFAULT_BITRATES }
  private segmentIndex = 0
  private produced: MediaRef[] = []
  private lastSegAt = 0

  getCaps(): MediaRecorderCaps {
    return { h265: false, h264: false, hwAccel: false, maxChannels: 3, metaOnly: true }
  }
  isActive() { return this.active }
  getActiveChannels() { return [...this.channels] }
  getActualCodec(): MediaCodec { return 'meta' }

  async start(opts: MediaRecorderStartOpts): Promise<void> {
    if (this.active) await this.stop()
    this.active = true
    this.sessionId = opts.sessionId
    this.channels = [...opts.channels]
    this.targetCodec = opts.codec
    this.segmentDurationSec = opts.segmentDurationSec || 60
    this.bitrates = { ...DEFAULT_BITRATES, ...opts.bitrates }
    this.segmentIndex = 0
    this.produced = []
    this.lastSegAt = Date.now()
    for (const ch of this.channels) this.produced.push(this.writeSegment(ch, true))
  }

  async stop(): Promise<MediaRef[]> {
    if (!this.active) return []
    this.active = false
    const out = [...this.produced]
    this.sessionId = null
    this.channels = []
    return out
  }

  async snapshot(channel: CameraChannel, triggerEventId?: string, label?: string): Promise<MediaRef | null> {
    if (!this.active && !archiveMock.getActiveSessionId()) return null
    const sid = this.sessionId ?? archiveMock.getActiveSessionId()
    if (!sid) return null
    const mono = archiveMock.getSessionMonoMs(sid)
    const ref: Omit<MediaRef, 'id' | 'session_id'> = {
      ts_utc: new Date().toISOString(),
      t_mono_ms: mono,
      channel,
      kind: 'SNAPSHOT',
      trigger_event_id: triggerEventId,
      label: label ?? `SNAPSHOT ${channel}`,
      codec: 'jpeg',
      container: 'none',
      width: RES[channel].w,
      height: RES[channel].h,
    }
    archiveMock.attachMediaRef(ref)
    const full = { ...ref, id: `MED-snap-${Date.now()}`, session_id: sid }
    this.produced.push(full as MediaRef)
    return full as MediaRef
  }

  tickSegment(): MediaRef[] {
    if (!this.active || !this.sessionId) return []
    const now = Date.now()
    const demoPeriodMs = Math.min(10_000, this.segmentDurationSec * 1000)
    if (now - this.lastSegAt < demoPeriodMs) return []
    this.lastSegAt = now
    return this.channels.map((ch) => this.writeSegment(ch, false))
  }

  private writeSegment(channel: CameraChannel, isOpen: boolean): MediaRef {
    const sid = this.sessionId ?? archiveMock.getActiveSessionId() ?? 'unknown'
    const mono = archiveMock.getSessionMonoMs(sid)
    this.segmentIndex += 1
    const r = RES[channel]
    const br = this.bitrates[channel] ?? DEFAULT_BITRATES[channel]
    const ref: Omit<MediaRef, 'id' | 'session_id'> = {
      ts_utc: new Date().toISOString(),
      t_mono_ms: mono,
      channel,
      kind: 'SEGMENT',
      label: isOpen
        ? `SEG ${channel} open · target ${this.targetCodec.toUpperCase()} (demo meta)`
        : `SEG ${channel} · target ${this.targetCodec.toUpperCase()} (demo meta)`,
      duration_ms: isOpen ? 0 : Math.min(10_000, this.segmentDurationSec * 1000),
      codec: 'meta',
      container: 'mp4',
      width: r.w,
      height: r.h,
      fps: r.fps,
      bitrate_kbps: br,
      hw_encoder: false,
    }
    archiveMock.attachMediaRef(ref)
    const full = { ...ref, id: `MED-seg-${this.segmentIndex}-${channel}`, session_id: sid } as MediaRef
    this.produced.push(full)
    return full
  }
}

export const mediaRecorderMock = new MockMediaRecorder()

export const DEFAULT_SIDECAR_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SIDECAR_URL) ||
  'http://127.0.0.1:8787'

export function absMediaUrl(url?: string, base: string = DEFAULT_SIDECAR_URL): string | undefined {
  if (!url) return undefined
  if (/^https?:/i.test(url)) return url
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
}

function ingestRefs(refs: MediaRef[] | undefined, base: string) {
  if (!refs) return
  for (const ref of refs) {
    archiveMock.attachMediaRef({
      ts_utc: ref.ts_utc,
      t_mono_ms: ref.t_mono_ms,
      channel: ref.channel,
      kind: ref.kind,
      label: ref.label,
      codec: ref.codec,
      container: ref.container,
      bitrate_kbps: ref.bitrate_kbps,
      hw_encoder: ref.hw_encoder,
      url: absMediaUrl(ref.url, base),
      trigger_event_id: ref.trigger_event_id,
      duration_ms: ref.duration_ms,
    })
  }
}

export class HttpMediaRecorder implements IMediaRecorder {
  private baseUrl: string
  private active = false
  private sessionId: string | null = null
  private channels: CameraChannel[] = []
  private actualCodec: MediaCodec = 'h265'
  private lastRefs: MediaRef[] = []

  constructor(baseUrl: string = DEFAULT_SIDECAR_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json()) as T & { ok?: boolean; message?: string }
    if (!res.ok) throw new Error((data as { message?: string }).message || `HTTP ${res.status}`)
    return data
  }

  getCaps(): MediaRecorderCaps {
    return (
      HttpMediaRecorder.cachedCaps ?? {
        h265: true, h264: true, hwAccel: false, maxChannels: 3, metaOnly: false, ffmpeg: true,
      }
    )
  }

  static cachedCaps: MediaRecorderCaps | null = null
  static lastStatus: SidecarStatus | null = null

  static async probe(baseUrl: string = DEFAULT_SIDECAR_URL): Promise<MediaRecorderCaps | null> {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/caps`, { signal: AbortSignal.timeout(2000) })
      if (!res.ok) return null
      const c = (await res.json()) as MediaRecorderCaps & { ok?: boolean; ffmpeg?: boolean }
      if (c.metaOnly === undefined) c.metaOnly = false
      HttpMediaRecorder.cachedCaps = c
      return c
    } catch {
      return null
    }
  }

  static async discover(baseUrl: string = DEFAULT_SIDECAR_URL, scan = false): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan }),
        signal: AbortSignal.timeout(8000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  static async fetchRingIndex(baseUrl: string = DEFAULT_SIDECAR_URL): Promise<{ url?: string; channel?: string; t_mono_ms?: number; id?: string; kind?: string; codec?: string; container?: string; label?: string; path?: string }[]> {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/ring/index`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return []
      const data = (await res.json()) as { files?: { url: string; channel: string; t_mono_ms: number; id: string; kind: string; codec: string; container: string; file: string; path: string }[] }
      return data.files || []
    } catch {
      return []
    }
  }

  static async fetchStatus(baseUrl: string = DEFAULT_SIDECAR_URL): Promise<SidecarStatus | null> {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/status`, { signal: AbortSignal.timeout(2000) })
      if (!res.ok) return null
      const s = (await res.json()) as SidecarStatus
      HttpMediaRecorder.lastStatus = s
      return s
    } catch {
      return null
    }
  }

  isActive() { return this.active }
  getActiveChannels() { return [...this.channels] }
  getActualCodec() { return this.actualCodec }

  async start(opts: MediaRecorderStartOpts): Promise<void> {
    const data = await this.req<{
      ok: boolean
      message?: string
      sessionId: string
      channels: CameraChannel[]
      codec_actual: string
      refs?: MediaRef[]
    }>('POST', '/record/start', {
      sessionId: opts.sessionId,
      channels: opts.channels,
      codec: opts.codec,
      segmentDurationSec: opts.segmentDurationSec,
      bitrates: opts.bitrates,
      prerollSec: opts.prerollSec,
    })
    if (!data.ok) throw new Error(data.message || 'start failed')
    this.active = true
    this.sessionId = data.sessionId
    this.channels = data.channels || opts.channels
    this.actualCodec = (data.codec_actual as MediaCodec) || opts.codec
    this.lastRefs = data.refs || []
    ingestRefs(this.lastRefs, this.baseUrl)
  }

  async stop(): Promise<MediaRef[]> {
    if (!this.active) return []
    const data = await this.req<{ ok: boolean; refs?: MediaRef[] }>('POST', '/record/stop')
    this.active = false
    const refs = data.refs || []
    ingestRefs(refs, this.baseUrl)
    this.lastRefs = refs
    this.sessionId = null
    this.channels = []
    return refs
  }

  async snapshot(channel: CameraChannel, triggerEventId?: string, label?: string): Promise<MediaRef | null> {
    try {
      const data = await this.req<{ ok: boolean; ref?: MediaRef }>('POST', '/snapshot', {
        channel, triggerEventId, label, sessionId: this.sessionId,
      })
      if (!data.ok || !data.ref) return null
      ingestRefs([data.ref], this.baseUrl)
      return { ...data.ref, url: absMediaUrl(data.ref.url, this.baseUrl) }
    } catch {
      return null
    }
  }

  async clip(opts: { sessionId: string; channel: CameraChannel; tStartMs: number; tEndMs: number; label?: string }): Promise<MediaRef | null> {
    try {
      const data = await this.req<{ ok: boolean; ref?: MediaRef }>('POST', '/clip', opts)
      if (!data.ok || !data.ref) return null
      ingestRefs([data.ref], this.baseUrl)
      return { ...data.ref, url: absMediaUrl(data.ref.url, this.baseUrl) }
    } catch {
      return null
    }
  }

  tickSegment(): MediaRef[] { return [] }
}

let resolvedRecorder: IMediaRecorder = mediaRecorderMock

export async function resolveMediaRecorder(baseUrl: string = DEFAULT_SIDECAR_URL): Promise<IMediaRecorder> {
  const caps = await HttpMediaRecorder.probe(baseUrl)
  if (caps) {
    resolvedRecorder = new HttpMediaRecorder(baseUrl)
    return resolvedRecorder
  }
  resolvedRecorder = mediaRecorderMock
  return resolvedRecorder
}

export function getMediaRecorder(): IMediaRecorder {
  return resolvedRecorder
}

export { mediaRecorderMock as defaultRecorder }
