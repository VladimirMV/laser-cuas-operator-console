/**
 * Panoptes test-turret adapters (from index1.html contract).
 * PTZ joystick WS, telemetry WS, MJPEG stream URLs, base station stubs.
 */

import { panoptesConfig, type TurretLinkStatus, type TurretTelemetrySample } from '../lib/panoptesConfig'

export interface ITurretController {
  connect(): void
  disconnect(): void
  move(panNorm: number, tiltNorm: number): void
  stop(): void
  goto(panDeg: number, tiltDeg: number): Promise<void>
  home(): Promise<void>
  emergencyStop(): Promise<void>
  readonly connected: boolean
}

export type TelemetryHandler = (t: TurretTelemetrySample) => void

export interface ITurretTelemetry {
  connect(): void
  disconnect(): void
  onUpdate(cb: TelemetryHandler): () => void
  readonly link: TurretLinkStatus
}

function httpBase(host: string): string {
  return host.replace(/\/$/, '')
}

/** Real Panoptes turret over Wi-Fi / mDNS */
export class PanoptesTurretController implements ITurretController {
  private ws: WebSocket | null = null
  private _connected = false
  private lastPan = 0
  private lastTilt = 0
  private lastSent = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private onLink?: (ok: boolean) => void

  constructor(onLink?: (ok: boolean) => void) {
    this.onLink = onLink
  }

  get connected(): boolean {
    return this._connected
  }

  connect(): void {
    this.intentionalClose = false
    this.openWs()
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    try {
      this.ws?.close()
    } catch {
      /* */
    }
    this.ws = null
    this._connected = false
    this.onLink?.(false)
  }

  private openWs(): void {
    if (this.intentionalClose) return
    const url = `${panoptesConfig.turretWs}/ws/joystick`
    try {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.onopen = () => {
        this._connected = true
        this.onLink?.(true)
      }
      ws.onclose = () => {
        this._connected = false
        this.onLink?.(false)
        this.ws = null
        if (!this.intentionalClose) {
          this.reconnectTimer = setTimeout(() => this.openWs(), 2000)
        }
      }
      ws.onerror = () => {
        /* onclose will fire */
      }
    } catch {
      this._connected = false
      this.onLink?.(false)
      this.reconnectTimer = setTimeout(() => this.openWs(), 3000)
    }
  }

  move(panNorm: number, tiltNorm: number): void {
    const pan = clamp(panNorm, -1, 1)
    const tilt = clamp(tiltNorm, -1, 1)
    this.lastPan = pan
    this.lastTilt = tilt
    const now = performance.now()
    const minDt = 1000 / panoptesConfig.moveHz
    if (now - this.lastSent < minDt) return
    this.lastSent = now
    this.send({ action: 'move', pan, tilt })
  }

  stop(): void {
    this.lastPan = 0
    this.lastTilt = 0
    // Burst: PTZ firmware keeps last rate until stop; one packet can drop on Wi-Fi
    this.send({ action: 'stop' })
    this.send({ action: 'stop' })
    setTimeout(() => this.send({ action: 'stop' }), 60)
  }

  async goto(panDeg: number, tiltDeg: number): Promise<void> {
    await fetch(`${httpBase(panoptesConfig.turretHost)}/api/goto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pan: panDeg, tilt: tiltDeg }),
    }).catch(() => undefined)
  }

  async home(): Promise<void> {
    await fetch(`${httpBase(panoptesConfig.turretHost)}/api/home`, {
      method: 'POST',
    }).catch(() => undefined)
  }

  async emergencyStop(): Promise<void> {
    this.stop()
    await fetch(`${httpBase(panoptesConfig.turretHost)}/api/stop`, {
      method: 'POST',
    }).catch(() => undefined)
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg))
      } catch {
        /* */
      }
    }
  }
}

export class PanoptesTelemetry implements ITurretTelemetry {
  private ws: WebSocket | null = null
  private handlers = new Set<TelemetryHandler>()
  private _link: TurretLinkStatus = 'DISCONNECTED'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false

  get link(): TurretLinkStatus {
    return this._link
  }

  connect(): void {
    this.intentionalClose = false
    this.setLink('CONNECTING')
    this.openWs()
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    try {
      this.ws?.close()
    } catch {
      /* */
    }
    this.ws = null
    this.setLink('DISCONNECTED')
  }

  onUpdate(cb: TelemetryHandler): () => void {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  private setLink(l: TurretLinkStatus): void {
    this._link = l
  }

  private openWs(): void {
    if (this.intentionalClose) return
    const url = `${panoptesConfig.turretWs}/ws/telemetry`
    try {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.onopen = () => this.setLink('OK')
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data))
          const sample = mapTelemetry(data, 'OK')
          this.handlers.forEach((h) => h(sample))
        } catch {
          /* */
        }
      }
      ws.onclose = () => {
        this.ws = null
        this.setLink('LOST')
        this.handlers.forEach((h) =>
          h({
            pan: 0,
            tilt: 0,
            ptzStatus: 'lost',
            link: 'LOST',
            ts: Date.now(),
          })
        )
        if (!this.intentionalClose) {
          this.reconnectTimer = setTimeout(() => {
            this.setLink('CONNECTING')
            this.openWs()
          }, 2000)
        }
      }
      ws.onerror = () => {
        /* close handles */
      }
    } catch {
      this.setLink('LOST')
      this.reconnectTimer = setTimeout(() => this.openWs(), 3000)
    }
  }
}

function parseCoord(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  let s = String(v).trim().replace(',', '.')
  const hemi = s.match(/[NSEW]$/i)
  if (hemi) s = s.slice(0, -1).trim()
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return undefined
  if (hemi && /[SW]/i.test(hemi[0])) return -Math.abs(n)
  return n
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = parseCoord(obj[k])
      if (n !== undefined) return n
    }
  }
  return undefined
}

function mapGps(data: Record<string, unknown>): TurretTelemetrySample['gps'] {
  const sensors = (data.sensors || {}) as Record<string, unknown>
  const raw = (data.gps || data.GPS || data.gnss || data.GNSS || sensors.gps || {}) as Record<string, unknown>
  const src = { ...data, ...raw }
  const lat = pickNum(src, ['lat', 'latitude', 'Lat'])
  const lon = pickNum(src, ['lon', 'lng', 'longitude', 'Lon', 'long'])
  const sats = pickNum(src, ['sats', 'satellites', 'sat', 'num_sats']) ?? 0
  const statusRaw = String(raw.status ?? src.gps_status ?? '').toLowerCase()
  const fixFlag =
    raw.fix === true ||
    raw.fix === 1 ||
    raw.fix === '1' ||
    raw.has_fix === true ||
    String(raw.fix).toLowerCase() === 'true' ||
    statusRaw.includes('3d') ||
    statusRaw === 'fix'
  const coordsOk =
    lat != null &&
    lon != null &&
    Math.abs(lat) > 0.00015 &&
    Math.abs(lon) > 0.00015 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  const moduleOk = ['ok', 'online', 'ready', 'fix', '3d', '2d'].includes(statusRaw) || coordsOk
  if (!moduleOk && lat == null && lon == null && raw.status === undefined) return undefined
  return {
    lat: coordsOk ? (lat as number) : 0,
    lon: coordsOk ? (lon as number) : 0,
    sats,
    fix: Boolean(fixFlag || coordsOk),
    status: coordsOk ? 'ok' : statusRaw || 'nofix',
    valid: coordsOk,
  }
}

function mapTelemetry(data: Record<string, unknown>, link: TurretLinkStatus): TurretTelemetrySample {
  const ptz = (data.ptz || data.PTZ || {}) as Record<string, unknown>
  const imu = (data.imu || data.IMU || {}) as Record<string, unknown>
  return {
    pan: num(ptz.pan ?? ptz.azimuth ?? data.pan),
    tilt: num(ptz.tilt ?? ptz.elevation ?? data.tilt),
    ptzStatus: String(ptz.status ?? 'unknown'),
    imu:
      imu.status !== undefined || imu.roll !== undefined
        ? {
            roll: num(imu.roll),
            pitch: num(imu.pitch),
            yaw: num(imu.yaw),
            status: String(imu.status ?? 'ok'),
          }
        : undefined,
    gps: mapGps(data),
    link,
    ts: Date.now(),
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Stream URL resolution for HMI channels */
export function getPanoptesStreamUrl(channel: 'LONG' | 'WIDE' | 'IR'): string | null {
  if (!panoptesConfig.useRealTurret) return null
  if (channel === 'LONG') return panoptesConfig.streams.longPrimary
  if (channel === 'IR') return panoptesConfig.streams.ir
  return null // WIDE not fitted
}

export function getPanoptesStreamFallback(channel: 'LONG' | 'WIDE' | 'IR'): string | null {
  if (channel === 'LONG') return panoptesConfig.streams.longFallback
  return null
}

/** Singleton controller + telemetry for the session */
let controller: PanoptesTurretController | null = null
let telemetry: PanoptesTelemetry | null = null

export function getPanoptesController(
  onLink?: (ok: boolean) => void
): PanoptesTurretController {
  if (!controller) controller = new PanoptesTurretController(onLink)
  return controller
}

export function getPanoptesTelemetry(): PanoptesTelemetry {
  if (!telemetry) telemetry = new PanoptesTelemetry()
  return telemetry
}
