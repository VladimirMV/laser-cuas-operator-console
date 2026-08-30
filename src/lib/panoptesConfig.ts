/**
 * Panoptes test turret integration config.
 * Override via Vite env (see .env.example).
 */

function env(key: string, fallback: string): string {
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key]
    return (v && String(v).trim()) || fallback
  } catch {
    return fallback
  }
}

function envBool(key: string, fallback: boolean): boolean {
  const v = env(key, fallback ? 'true' : 'false').toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export const panoptesConfig = {
  /** When true, use real MJPEG + WS turret instead of demo HLS / mock slew */
  useRealTurret: envBool('VITE_USE_REAL_TURRET', true),

  turretHost: env('VITE_TURRET_HOST', 'http://panoptes.local').replace(/\/$/, ''),
  baseHost: env('VITE_BASE_HOST', 'http://panoptes-base.local').replace(/\/$/, ''),

  /** Derived WS origins */
  get turretWs(): string {
    const h = env('VITE_TURRET_WS', '')
    if (h) return h.replace(/\/$/, '')
    return this.turretHost.replace(/^http/, 'ws')
  },
  get baseWs(): string {
    const h = env('VITE_BASE_WS', '')
    if (h) return h.replace(/\/$/, '')
    return this.baseHost.replace(/^http/, 'ws')
  },

  streams: {
    /** Day 2K → LONG */
    longPrimary: env(
      'VITE_STREAM_LONG',
      'http://panoptes-base.local/2k-stream'
    ),
    longFallback: env(
      'VITE_STREAM_LONG_FALLBACK',
      'http://panoptes.local/2k-stream'
    ),
    /** Thermal Mars 2 → IR */
    ir: env('VITE_STREAM_IR', 'http://panoptes.local/thermal/stream'),
    /** WIDE not fitted on this turret */
    wide: null as string | null,
  },

  /** Joystick command rate limit */
  moveHz: 40,
}

export type TurretLinkStatus = 'DISCONNECTED' | 'CONNECTING' | 'OK' | 'LOST'

export interface TurretTelemetrySample {
  pan: number
  tilt: number
  ptzStatus: string
  imu?: { roll: number; pitch: number; yaw: number; status: string }
  gps?: {
    lat: number
    lon: number
    sats: number
    fix: boolean
    status: string
    valid?: boolean
  }
  link: TurretLinkStatus
  ts: number
}
