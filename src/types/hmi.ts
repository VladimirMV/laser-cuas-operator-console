export type LaserStatus = 'SAFE' | 'ARMED' | 'FIRING'
export type TrackState = 'SEARCH' | 'TRACKING' | 'COAST' | 'LOST'
export type OperationMode = 'MANUAL' | 'SEMI' | 'AUTO'
export type CameraChannel = 'LONG' | 'WIDE' | 'IR'
/** Main central display: cameras or tactical map */
export type MainView = CameraChannel | 'MAP'
export type AppScreen = 'COMBAT' | 'CALIBRATION' | 'BITE' | 'MAINTENANCE' | 'SESSIONS' | 'CAMERA_SETTINGS'
export type SystemStatus = 'OK' | 'DEGRADED' | 'FAULT'
export type CalibrationStatus = 'VALID' | 'CHECK_REQUIRED' | 'EXPIRED'
export type Lang = 'en' | 'ua'
export type CueSource = 'RADAR' | 'C2' | 'ACOUSTIC' | 'EO' | 'MANUAL'
export type CueStatus = 'NEW' | 'SLEWING' | 'ACQUIRED' | 'STALE' | 'DROPPED'

/** Soft-kill ladder effectors (laser stays separate safety chain) */
export type EffectorId = 'JAM' | 'SPOOF' | 'DAZZLE' | 'LASER'
export type EffectorStatus = 'READY' | 'BUSY' | 'FAULT' | 'NOT_FITTED' | 'ACTIVE'

/** What automation is doing right now (SEMI/AUTO feedback) */
export type AutomationState =
  | 'IDLE'
  | 'SLEWING'
  | 'TRACKING'
  | 'COASTING'
  | 'WAITING_CONFIRM'
  | 'SEARCHING'

export type LayoutProfile = 'laptop' | 'soc' | 'vehicle'

export type EventType =
  | 'CUE_RECEIVED'
  | 'SLEW'
  | 'TRACK_ACQUIRE'
  | 'TRACK_LOST'
  | 'ARM'
  | 'SAFE'
  | 'FIRE_START'
  | 'FIRE_END'
  | 'MODE_CHANGE'
  | 'CAL_START'
  | 'CAL_END'
  | 'BITE'
  | 'FAULT'
  | 'REC_START'
  | 'REC_STOP'
  | 'EFFECTOR'

export type EventSource = 'UI' | 'HOTKEY' | 'EXTERNAL' | 'SYSTEM'

export interface ParallaxCoeffs {
  a: number
  c: number
  d: number
  e: number
  r0: number
}

export interface TargetData {
  range: number
  azimuth: number
  elevation: number
  omegaAz: number
  omegaEl: number
  classification: string
  trackQuality: number
  trackState: TrackState
  coastTimer: number
  posX: number
  posY: number
  lat?: number
  lon?: number
  alt?: number
}

export interface PlatformGps {
  lat: number
  lon: number
  alt: number
  heading: number
  fix: '3D' | '2D' | 'NONE'
  sats: number
}

export interface TurretState {
  az: number
  el: number
  azRate: number
  elRate: number
}

export interface CameraAdjust {
  brightness: number
  contrast: number
}

export type CameraAdjustMap = Record<CameraChannel, CameraAdjust>

export interface ExternalCue {
  id: string
  source: CueSource
  label: string
  azimuth: number
  elevation: number
  range?: number
  quality: number
  status: CueStatus
  ageSec: number
}

export interface EventLogEntry {
  id: string
  ts: string
  type: EventType
  source: EventSource
  message: string
  payload?: Record<string, string | number | boolean | null>
}

export interface SessionRecord {
  id: string
  startedAt: string
  endedAt?: string
  durationSec: number
  channels: CameraChannel[]
  events: number
  note: string
  recording: boolean
  eventLog: EventLogEntry[]
}

export interface EffectorState {
  id: EffectorId
  status: EffectorStatus
  label: string
}


export type LaserDeviceState = 'STANDBY' | 'SIMMER' | 'FIRE_AUTO' | 'FIRE_EXT' | 'FAULT'
export type LaserWavelength = 1064 | 532 | 355 | 266 | 213
export type LaserSyncMode = 'INTERNAL' | 'EXTERNAL'

export interface LaserInterlocks {
  keySwitch: boolean
  eStop: boolean
  cover: boolean
  coolant: boolean
  door: boolean
  overTemp: boolean
}

export interface LaserTelemetry {
  /** Quantel Q-smart 450 mock / real adapter feed */
  model: string
  linkOk: boolean
  deviceState: LaserDeviceState
  emission: boolean
  wavelengthNm: LaserWavelength
  energySetJ: number
  energySetMaxJ: number
  energyMeas_mJ: number | null
  repRateHz: number
  repRateMaxHz: number
  pulseDurationNs: number
  divergenceMrad: number
  shotUser: number
  shotLife: number
  shotLifeMax: number
  tempHeadC: number
  tempPsuC: number
  tempCoolantC: number
  attenuatorPct: number
  syncMode: LaserSyncMode
  qsArmed: boolean
  harmonicOk: boolean
  interlocks: LaserInterlocks
  lastError: string | null
  lampLifePct: number
}

export interface TelemetryExtras {
  tempLaser: number
  tempBoard: number
  pulseCount: number
}

export interface CalMeasurement {
  range: number
  du: number
  dv: number
}

export interface BiteItem {
  id: string
  status: 'OK' | 'DEGRADED' | 'FAULT'
  value: string
}

export interface ToastMsg {
  id: string
  text: string
  level: 'info' | 'warn' | 'error'
}
