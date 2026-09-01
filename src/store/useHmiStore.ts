import { create } from 'zustand'
import type {
  LaserStatus,
  OperationMode,
  CameraChannel,
  MainView,
  AppScreen,
  SystemStatus,
  CalibrationStatus,
  TargetData,
  ParallaxCoeffs,
  TelemetryExtras,
  CalMeasurement,
  Lang,
  BiteItem,
  PlatformGps,
  TurretState,
  CameraAdjustMap,
  ExternalCue,
  SessionRecord,
  EventLogEntry,
  EventType,
  EventSource,
  EffectorState,
  EffectorId,
  AutomationState,
  LayoutProfile,
  ToastMsg,
  LaserTelemetry,
  LaserWavelength,
  CombatChrome,
  RightDockTab,
} from '../types/hmi'
import { fitParallax } from '../lib/utils'
import { destinationPoint } from '../lib/geo'
import { quantelMock, createDefaultLaserTelemetry } from '../adapters/laser'
import {
  archiveMock,
  mapLegacyEventType,
  mapLegacySource,
  SW_VERSION,
} from '../adapters/archive'
import { getMediaRecorder, HttpMediaRecorder, absMediaUrl } from '../adapters/mediaRecorder'
import { getPanoptesController } from '../adapters/panoptes'
import type { AiBox } from '../adapters/panoptesAi'
import { setBaseTracking } from '../adapters/panoptesBase'
import { panoptesConfig } from '../lib/panoptesConfig'
import type { TurretLinkStatus } from '../lib/panoptesConfig'
import type { RecordingProfile, RecordingPreset, RecordingChannels } from '../types/archive'
import {
  DEFAULT_RECORDING_PROFILE,
  channelsFromPreset,
  activeChannelList,
} from '../types/archive'


interface HmiStore {
  systemStatus: SystemStatus
  laserStatus: LaserStatus
  calibrationStatus: CalibrationStatus
  mode: OperationMode
  automation: AutomationState
  activeCamera: MainView
  zoom: number
  screen: AppScreen
  target: TargetData | null
  parallax: ParallaxCoeffs
  extras: TelemetryExtras
  laserTelemetry: LaserTelemetry
  calStep: number
  calMeasurements: CalMeasurement[]
  armConfirm: boolean
  lang: Lang
  biteItems: BiteItem[]
  biteRunning: boolean

  platform: PlatformGps
  gpsLastGoodAt: number
  turret: TurretState
  cameraAdjust: CameraAdjustMap
  cues: ExternalCue[]
  sessions: SessionRecord[]
  recording: boolean
  recordingStartedAt: number | null
  recordingChannels: CameraChannel[]
  recordingProfile: RecordingProfile
  /** Actual encode mode: meta in demo, h265/h264 in production */
  recordingActualCodec: 'h265' | 'h264' | 'meta'
  sidecarConnected: boolean
  mediaRoot: string
  gamepadConnected: boolean
  aiEnabled: boolean
  aiTargets: AiBox[]
  aiActiveId: string | null
  aiLink: 'OFF' | 'CONNECTING' | 'OK' | 'LOST'
  aiTracking: boolean
  turretLink: TurretLinkStatus
  turretImu: { roll: number; pitch: number; yaw: number } | null
  showCameraSettings: boolean
  showServicePin: boolean
  showServiceMenu: boolean
  serviceUnlocked: boolean
  isFullscreen: boolean

  /** Live event log (always on, even without REC) */
  eventLog: EventLogEntry[]
  effectors: EffectorState[]
  layoutProfile: LayoutProfile
  combatChrome: CombatChrome
  rightDock: RightDockTab
  ringHot: boolean
  mapTrackUp: boolean
  toast: ToastMsg | null
  selectedSessionId: string | null
  showHelp: boolean
  rightPanelCollapsed: boolean

  setLaserStatus: (s: LaserStatus) => void
  setMode: (m: OperationMode, source?: EventSource) => void
  setActiveCamera: (c: MainView) => void
  setZoom: (z: number) => void
  setScreen: (s: AppScreen) => void
  setArmConfirm: (v: boolean) => void
  setLang: (l: Lang) => void
  toggleLang: () => void
  setLayoutProfile: (p: LayoutProfile) => void
  setCombatChrome: (c: CombatChrome) => void
  setRightDock: (t: RightDockTab) => void
  setMapTrackUp: (v: boolean) => void
  setShowHelp: (v: boolean) => void
  toggleHelp: () => void
  toggleRightPanel: () => void
  clearToast: () => void
  showToast: (text: string, level?: ToastMsg['level']) => void
  logEvent: (
    type: EventType,
    message: string,
    source?: EventSource,
    payload?: EventLogEntry['payload']
  ) => void

  arm: (source?: EventSource) => void
  confirmArm: (source?: EventSource) => void
  safe: (source?: EventSource) => void
  fireStart: (source?: EventSource) => void
  fireEnd: (source?: EventSource) => void

  loseTrack: (source?: EventSource) => void
  reacquire: (source?: EventSource) => void
  tickCoast: () => void

  openCalibration: () => void
  openBite: () => void
  openMaintenance: () => void
  closeMaintenance: () => void
  openSessions: () => void
  closeSessions: () => void
  selectSession: (id: string | null) => void
  nextCalStep: () => void
  prevCalStep: () => void
  addCalMeasurement: (m: CalMeasurement) => void
  updateCalMeasurement: (range: number, patch: Partial<Pick<CalMeasurement, 'du' | 'dv' | 'range'>>) => void
  finishCalibration: () => void
  cancelCalibration: () => void
  runBite: () => void
  closeBite: () => void

  setCameraAdjust: (ch: CameraChannel, key: 'brightness' | 'contrast' | 'zoom', value: number) => void
  resetCameraAdjust: (ch?: CameraChannel) => void
  setShowCameraSettings: (v: boolean) => void
  bumpZoom: (delta: number) => void
  requestService: () => void
  submitServicePin: (pin: string) => boolean
  closeServiceUi: () => void
  setFullscreenFlag: (v: boolean) => void
  toggleFullscreen: () => void
  exitFullscreen: () => void
  slewTurret: (dAz: number, dEl: number) => void
  stopTurretSlew: () => void
  setTurret: (az: number, el: number) => void
  slewToCue: (cueId: string, source?: EventSource) => void
  dismissCue: (cueId: string) => void
  tickCues: () => void
  toggleRecording: () => void
  setRecordingPreset: (mode: RecordingPreset) => void
  setRecChannel: (ch: CameraChannel, on: boolean) => void
  setRecordingCodec: (c: 'h265' | 'h264') => void
  tickRecordingSegments: () => void
  snapshotRecording: (trigger: string, eventId?: string) => void
  pollSidecar: () => Promise<void>
  exportEngagementClip: (sessionId: string, channel?: CameraChannel) => Promise<string | null>
  setGamepadConnected: (v: boolean) => void
  toggleAi: () => void
  setAiLink: (l: 'OFF' | 'CONNECTING' | 'OK' | 'LOST') => void
  applyAiTargets: (boxes: AiBox[], activeId: string | null, link?: 'OFF' | 'CONNECTING' | 'OK' | 'LOST') => void
  setAiTracking: (on: boolean) => void
  startAiDetect: () => Promise<void>
  stopAiDetect: () => Promise<void>
  selectAiBox: (id: string) => void
  markTargetAtAim: (source?: EventSource) => void
  dropTrack: (source?: EventSource) => void
  toggleTrackAtAim: (source?: EventSource) => void
  setTurretLink: (l: TurretLinkStatus) => void
  applyTurretTelemetry: (t: {
    pan: number
    tilt: number
    gps?: { lat: number; lon: number; sats: number; fix: boolean; status: string; valid?: boolean }
    imu?: { roll: number; pitch: number; yaw: number; status: string }
    link: TurretLinkStatus
  }) => void
  turretGoto: (pan: number, tilt: number) => Promise<void>
  turretHome: () => Promise<void>
  turretEStop: () => Promise<void>
  stopRecording: () => void
  refreshTargetGps: () => void

  /** Soft-kill ladder stubs */
  activateEffector: (id: EffectorId) => void
  exportEventLogJson: () => string
  exportEventLogCsv: () => string
  ensureArchiveSession: () => string
  sealArchiveSession: () => void
  deleteArchiveSession: (id: string) => boolean
  exportArchiveSessionJson: (id: string) => string
  exportArchiveSessionCsv: (id: string) => string
  listArchiveSessions: () => ReturnType<typeof archiveMock.listSessions>
  getArchiveBundle: (id: string) => ReturnType<typeof archiveMock.getSession>
  archiveTickTelemetry: () => void

  /** Quantel mock / adapter */
  refreshLaserTelemetry: () => Promise<void>
  laserSimmer: () => Promise<void>
  laserStandby: () => Promise<void>
  setLaserEnergyJ: (j: number) => Promise<void>
  setLaserRepRateHz: (hz: number) => Promise<void>
  setLaserWavelength: (nm: LaserWavelength) => Promise<void>
  setLaserAttenuator: (pct: number) => Promise<void>
  resetLaserUserCounter: () => Promise<void>
}

const initialTarget: TargetData = {
  range: 1847,
  azimuth: 127.4,
  elevation: 8.2,
  omegaAz: 0.35,
  omegaEl: -0.12,
  classification: 'FPV DRONE',
  trackQuality: 0,
  trackState: 'SEARCH',
  coastTimer: 0,
  posX: 50,
  posY: 50,
}

const defaultParallax: ParallaxCoeffs = {
  a: -0.4,
  c: 800,
  d: 0.15,
  e: -300,
  r0: 2000,
}

const defaultBite: BiteItem[] = [
  { id: 'laserModule', status: 'OK', value: 'READY' },
  { id: 'longFocusCam', status: 'OK', value: 'OK' },
  { id: 'wideCam', status: 'OK', value: 'OK' },
  { id: 'irCam', status: 'OK', value: 'OK' },
  { id: 'gimbal', status: 'OK', value: 'STABLE' },
  { id: 'rangeFinder', status: 'OK', value: 'OK' },
  { id: 'powerSupply', status: 'OK', value: '28.1 V' },
  { id: 'cooling', status: 'OK', value: '42 °C' },
  { id: 'calibStatus', status: 'OK', value: 'VALID' },
]

const defaultCam: CameraAdjustMap = {
  LONG: { brightness: 100, contrast: 100, zoom: 4.2 },
  WIDE: { brightness: 100, contrast: 100, zoom: 1.0 },
  IR: { brightness: 110, contrast: 120, zoom: 1.0 },
}

export const CAMERA_ZOOM: Record<CameraChannel, { min: number; max: number; step: number; hasZoom: boolean }> = {
  LONG: { min: 1, max: 8, step: 0.2, hasZoom: true },
  WIDE: { min: 1, max: 2, step: 0.1, hasZoom: true },
  IR: { min: 1, max: 4, step: 0.2, hasZoom: true },
}

const defaultPlatform: PlatformGps = {
  lat: 0,
  lon: 0,
  alt: 0,
  heading: 0,
  fix: 'NONE',
  sats: 0,
}

const defaultCues: ExternalCue[] = [
  {
    id: 'R-014',
    source: 'RADAR',
    label: 'Track R-014',
    azimuth: 131.2,
    elevation: 6.5,
    range: 2100,
    quality: 88,
    status: 'NEW',
    ageSec: 2,
  },
  {
    id: 'C2-07',
    source: 'C2',
    label: 'Cue C2-07',
    azimuth: 98.0,
    elevation: 12.0,
    range: 3400,
    quality: 72,
    status: 'NEW',
    ageSec: 8,
  },
  {
    id: 'AC-3',
    source: 'ACOUSTIC',
    label: 'Acoustic AC-3',
    azimuth: 155.5,
    elevation: 4.0,
    quality: 55,
    status: 'STALE',
    ageSec: 25,
  },
]

const defaultEffectors: EffectorState[] = [
  { id: 'JAM', status: 'NOT_FITTED', label: 'JAM' },
  { id: 'SPOOF', status: 'NOT_FITTED', label: 'SPOOF' },
  { id: 'DAZZLE', status: 'NOT_FITTED', label: 'DAZZLE' },
  { id: 'LASER', status: 'READY', label: 'LASER' },
]

function withTargetGps(platform: PlatformGps, t: TargetData): TargetData {
  const bearing = (platform.heading + t.azimuth + 360) % 360
  const horiz = t.range * Math.cos((t.elevation * Math.PI) / 180)
  const dest = destinationPoint(platform.lat, platform.lon, horiz, bearing)
  const alt = platform.alt + t.range * Math.sin((t.elevation * Math.PI) / 180)
  return { ...t, lat: dest.lat, lon: dest.lon, alt }
}

function loadChrome(): CombatChrome {
  try {
    const v = localStorage.getItem('hmi-chrome')
    if (v === 'hud' || v === 'stack') return v
  } catch { /* */ }
  return 'hud'
}

function loadLayout(): LayoutProfile {
  try {
    const v = localStorage.getItem('hmi-layout')
    if (v === 'laptop' || v === 'soc' || v === 'vehicle') return v
  } catch { /* SSR / private mode */ }
  return 'soc'
}

function loadLang(): Lang {
  try {
    const v = localStorage.getItem('hmi-lang')
    if (v === 'en' || v === 'ua') return v
  } catch { /* SSR / private mode */ }
  return 'ua'
}

const seededTarget = withTargetGps(defaultPlatform, initialTarget)

let eventSeq = 0
function makeEvent(
  type: EventType,
  message: string,
  source: EventSource = 'SYSTEM',
  payload?: EventLogEntry['payload']
): EventLogEntry {
  eventSeq += 1
  return {
    id: `EVT-${Date.now()}-${eventSeq}`,
    ts: new Date().toISOString(),
    type,
    source,
    message,
    payload,
  }
}

const sampleLog: EventLogEntry[] = [
  makeEvent('TRACK_ACQUIRE', 'Track acquired FPV DRONE R=1847m', 'SYSTEM', { range: 1847 }),
  makeEvent('CUE_RECEIVED', 'Radar cue R-014', 'EXTERNAL', { id: 'R-014' }),
]

export const useHmiStore = create<HmiStore>((set, get) => ({
  systemStatus: 'OK',
  laserStatus: 'SAFE',
  calibrationStatus: 'VALID',
  mode: 'MANUAL',
  automation: 'SEARCHING',
  activeCamera: 'LONG',
  zoom: 4.2,
  screen: 'COMBAT',
  target: seededTarget,
  parallax: defaultParallax,
  extras: { tempLaser: 42, tempBoard: 38, pulseCount: 12847 },
  laserTelemetry: createDefaultLaserTelemetry(),
  calStep: 0,
  calMeasurements: [],
  armConfirm: false,
  lang: loadLang(),
  biteItems: defaultBite,
  biteRunning: false,

  platform: defaultPlatform,
  gpsLastGoodAt: 0,
  turret: { az: 127.4, el: 8.2, azRate: 0, elRate: 0 },
  cameraAdjust: defaultCam,
  cues: defaultCues,
  sessions: [
    {
      id: 'SES-2026-08-16-01',
      startedAt: '2026-08-16T14:22:00',
      endedAt: '2026-08-16T14:41:12',
      durationSec: 1152,
      channels: ['LONG', 'IR'],
      events: 4,
      note: 'FPV engagement demo',
      recording: false,
      eventLog: [
        makeEvent('REC_START', 'Recording started', 'UI'),
        makeEvent('TRACK_ACQUIRE', 'FPV track', 'SYSTEM'),
        makeEvent('ARM', 'Laser ARMED', 'UI'),
        makeEvent('FIRE_START', 'FIRE', 'UI'),
      ],
    },
    {
      id: 'SES-2026-08-15-03',
      startedAt: '2026-08-15T09:05:00',
      endedAt: '2026-08-15T09:18:40',
      durationSec: 820,
      channels: ['LONG', 'WIDE', 'IR'],
      events: 2,
      note: 'Radar cue handoff',
      recording: false,
      eventLog: [
        makeEvent('CUE_RECEIVED', 'C2-07', 'EXTERNAL'),
        makeEvent('SLEW', 'Slew to C2-07', 'UI'),
      ],
    },
  ],
  recording: false,
  recordingStartedAt: null,
  recordingChannels: ['LONG', 'IR'],
  recordingProfile: { ...DEFAULT_RECORDING_PROFILE },
  recordingActualCodec: 'meta',
  sidecarConnected: false,
  mediaRoot: '',
  gamepadConnected: false,
  aiEnabled: false,
  aiTargets: [],
  aiActiveId: null,
  aiLink: 'OFF',
  aiTracking: false,
  turretLink: 'DISCONNECTED',
  turretImu: null,
  showCameraSettings: false,
  showServicePin: false,
  showServiceMenu: false,
  serviceUnlocked: false,
  isFullscreen: false,

  eventLog: sampleLog,
  effectors: defaultEffectors,
  layoutProfile: loadLayout(),
  combatChrome: loadChrome(),
  rightDock: 'WEAPON',
  ringHot: false,
  mapTrackUp: false,
  toast: null,
  selectedSessionId: null,
  showHelp: false,
  rightPanelCollapsed: false,

  setLaserStatus: (s) => set({ laserStatus: s }),
  setMode: (m, source = 'UI') => {
    const prev = get().mode
    if (prev === m) return
    set({ mode: m })
    get().logEvent('MODE_CHANGE', `Mode ${prev} → ${m}`, source, { from: prev, to: m })
    // SEMI/AUTO automation hint
    if (m === 'MANUAL') set({ automation: get().target?.trackState === 'TRACKING' ? 'TRACKING' : 'IDLE' })
    if (m === 'SEMI') set({ automation: get().target?.trackState === 'TRACKING' ? 'TRACKING' : 'SEARCHING' })
    if (m === 'AUTO') set({ automation: 'WAITING_CONFIRM' })
  },
  setActiveCamera: (c) => set({ activeCamera: c }),
  setZoom: (z) => set({ zoom: z }),
  setScreen: (s) => set({ screen: s }),
  setArmConfirm: (v) => set({ armConfirm: v }),
  setLang: (l) => {
    try { localStorage.setItem('hmi-lang', l) } catch { /* */ }
    set({ lang: l })
  },
  toggleLang: () => {
    const s = get()
    const next = s.lang === 'ua' ? 'en' : 'ua'
    try { localStorage.setItem('hmi-lang', next) } catch { /* */ }
    set({ lang: next })
    // Visible feedback so operator sees switch took effect
    get().showToast(
      next === 'ua' ? 'Мова: українська (UA)' : 'Language: English (EN)',
      'info'
    )
  },
  setLayoutProfile: (p) => {
    try { localStorage.setItem('hmi-layout', p) } catch { /* */ }
    set({ layoutProfile: p })
  },
  setCombatChrome: (c) => {
    try { localStorage.setItem('hmi-chrome', c) } catch { /* */ }
    set({ combatChrome: c })
  },
  setRightDock: (t) => set({ rightDock: t }),
  setMapTrackUp: (v) => set({ mapTrackUp: v }),
  setShowHelp: (v) => set({ showHelp: v }),
  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  clearToast: () => set({ toast: null }),
  showToast: (text, level = 'info') => {
    const id = `t-${Date.now()}`
    set({ toast: { id, text, level } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2800)
  },
  logEvent: (type, message, source = 'SYSTEM', payload) => {
    const entry = makeEvent(type, message, source, payload)
    set((s) => ({ eventLog: [entry, ...s.eventLog].slice(0, 500) }))
    // Dual-write to mission archive (append-only)
    get().ensureArchiveSession()
    archiveMock.appendEvent({
      type: mapLegacyEventType(type),
      source: mapLegacySource(source),
      message,
      payload,
      result: 'OK',
      track_id: get().target ? `TRK-${get().target!.classification}` : undefined,
    })
    const preset = get().recordingProfile.mode
    if (
      preset === 'ON_ENGAGEMENT' &&
      !get().recording &&
      (type === 'TRACK_ACQUIRE' || type === 'SLEW')
    ) {
      get().toggleRecording()
    }
    if (preset === 'ON_ENGAGEMENT' && get().recording && (type === 'TRACK_LOST' || type === 'SAFE')) {
      window.setTimeout(() => {
        const st = get()
        if (st.recording && st.recordingProfile.mode === 'ON_ENGAGEMENT') st.toggleRecording()
      }, 2500)
    }
  },

  arm: (source = 'UI') => {
    const { laserStatus, target, mode, aiTracking } = get()
    if (laserStatus !== 'SAFE') return
    const locked =
      (target && (target.trackState === 'TRACKING' || target.trackState === 'COAST')) ||
      mode === 'MANUAL' ||
      aiTracking
    if (!locked) {
      get().showToast(
        get().lang === 'ua' ? 'ARM: немає треку — RB або AI ON' : 'ARM: no track — RB or AI ON',
        'warn'
      )
      return
    }
    set({ armConfirm: true, automation: 'WAITING_CONFIRM' })
  },
  confirmArm: (source = 'UI') => {
    const { target, mode, aiTracking } = get()
    const locked =
      (target && (target.trackState === 'TRACKING' || target.trackState === 'COAST')) ||
      mode === 'MANUAL' ||
      aiTracking
    if (!locked) {
      set({ armConfirm: false })
      return
    }
    set({ laserStatus: 'ARMED', armConfirm: false, automation: target?.trackState === 'TRACKING' ? 'TRACKING' : get().automation })
    get().logEvent('ARM', 'Laser ARMED', source, { range: target?.range ?? 0 })
    get().snapshotRecording('ARM')
  },
  safe: (source = 'UI') => {
    set({ laserStatus: 'SAFE', armConfirm: false })
    void quantelMock.standby().then(() => get().refreshLaserTelemetry())
    get().logEvent('SAFE', 'Laser SAFE', source)
  },
  fireStart: (source = 'UI') => {
    if (get().laserStatus !== 'ARMED') return
    set({ laserStatus: 'FIRING' })
    void quantelMock.startFireInternal().then(() => get().refreshLaserTelemetry())
    get().ensureArchiveSession()
    get().snapshotRecording('FIRE_START')
    archiveMock.attachMediaRef({
      ts_utc: new Date().toISOString(),
      t_mono_ms: archiveMock.getSessionMonoMs(),
      channel: get().activeCamera === 'MAP' ? 'LONG' : (get().activeCamera as 'LONG'|'WIDE'|'IR'),
      kind: 'SNAPSHOT',
      label: 'FIRE_START snapshot',
      codec: 'jpeg',
      container: 'none',
    })
    get().logEvent('FIRE_START', 'FIRE start', source, {
      range: get().target?.range ?? 0,
      mode: get().mode,
      energyJ: get().laserTelemetry.energySetJ,
      wavelengthNm: get().laserTelemetry.wavelengthNm,
    })
  },
  fireEnd: (source = 'UI') => {
    if (get().laserStatus !== 'FIRING') return
    set({ laserStatus: 'ARMED' })
    void quantelMock.stopFire().then(() => get().refreshLaserTelemetry())
    get().logEvent('FIRE_END', 'FIRE end', source)
    get().snapshotRecording('FIRE_END')
  },

  loseTrack: (source = 'UI') => {
    const t = get().target
    if (!t || t.trackState === 'LOST' || t.trackState === 'SEARCH') return
    set({
      laserStatus: 'SAFE',
      armConfirm: false,
      automation: 'COASTING',
      target: { ...t, trackState: 'COAST', trackQuality: 18, coastTimer: 8 },
    })
    get().ensureArchiveSession()
    get().snapshotRecording('TRACK_LOST')
    archiveMock.attachMediaRef({
      ts_utc: new Date().toISOString(),
      t_mono_ms: archiveMock.getSessionMonoMs(),
      channel: 'LONG',
      kind: 'SNAPSHOT',
      label: 'TRACK_LOST snapshot',
      codec: 'jpeg',
      container: 'none',
    })
    get().logEvent('TRACK_LOST', 'Track lost — coasting', source)
  },
  reacquire: (source = 'UI') => {
    const { platform } = get()
    set({
      target: withTargetGps(platform, {
        ...initialTarget,
        trackQuality: 88,
        trackState: 'TRACKING',
      }),
      turret: { az: initialTarget.azimuth, el: initialTarget.elevation, azRate: 0, elRate: 0 },
      automation: 'TRACKING',
    })
    get().logEvent('TRACK_ACQUIRE', 'Track re-acquired', source)
  },
  tickCoast: () => {
    const t = get().target
    if (!t || t.trackState !== 'COAST') return
    if (t.coastTimer <= 1) {
      set({ target: null, automation: 'SEARCHING', laserStatus: 'SAFE', armConfirm: false })
      get().logEvent('TRACK_LOST', 'Track LOST — laser inhibited', 'SYSTEM')
    } else {
      set({
        target: {
          ...t,
          coastTimer: t.coastTimer - 1,
          trackQuality: Math.max(5, t.trackQuality - 8),
        },
        automation: 'COASTING',
      })
    }
  },

  openCalibration: () => {
    if (get().laserStatus !== 'SAFE') return
    set({ screen: 'CALIBRATION', calStep: 0, calMeasurements: [] })
    get().logEvent('CAL_START', 'Calibration opened', 'UI')
  },
  openBite: () => {
    if (get().laserStatus !== 'SAFE') return
    set({ screen: 'BITE' })
  },
  openMaintenance: () => {
    if (get().laserStatus !== 'SAFE') return
    set({ screen: 'MAINTENANCE' })
  },
  closeMaintenance: () => set({ screen: 'COMBAT' }),
  openSessions: () => set({ screen: 'SESSIONS', selectedSessionId: null }),
  closeSessions: () => set({ screen: 'COMBAT', selectedSessionId: null }),
  selectSession: (id) => set({ selectedSessionId: id }),
  nextCalStep: () => set((s) => ({ calStep: Math.min(s.calStep + 1, 5) })),
  prevCalStep: () => set((s) => ({ calStep: Math.max(s.calStep - 1, 0) })),
  addCalMeasurement: (m) =>
    set((s) => ({
      calMeasurements: s.calMeasurements.some((x) => x.range === m.range)
        ? s.calMeasurements.map((x) => (x.range === m.range ? m : x))
        : [...s.calMeasurements, m],
    })),
  updateCalMeasurement: (range, patch) =>
    set((s) => ({
      calMeasurements: s.calMeasurements.map((x) =>
        x.range === range ? { ...x, ...patch } : x
      ),
    })),
  finishCalibration: () => {
    const { calMeasurements } = get()
    const fit = fitParallax(calMeasurements)
    if (fit && fit.rms <= 0.25) {
      set({
        parallax: { a: fit.a, c: fit.c, d: fit.d, e: fit.e, r0: fit.r0 },
        calibrationStatus: 'VALID',
        screen: 'COMBAT',
        calStep: 0,
      })
    } else if (fit) {
      set({
        parallax: { a: fit.a, c: fit.c, d: fit.d, e: fit.e, r0: fit.r0 },
        calibrationStatus: 'CHECK_REQUIRED',
        screen: 'COMBAT',
        calStep: 0,
      })
    } else set({ screen: 'COMBAT', calStep: 0 })
    get().logEvent('CAL_END', 'Calibration finished', 'UI')
  },
  cancelCalibration: () => set({ screen: 'COMBAT', calStep: 0, calMeasurements: [] }),
  runBite: () => {
    set({ biteRunning: true })
    get().logEvent('BITE', 'BITE started', 'UI')
    setTimeout(() => {
      set({
        biteRunning: false,
        biteItems: defaultBite.map((item) => ({
          ...item,
          status: Math.random() > 0.92 ? 'DEGRADED' : 'OK',
        })),
        // Composite SYS is derived live in StatusBar from turret/GPS/interlocks.
      })
    }, 1800)
  },
  closeBite: () => set({ screen: 'COMBAT' }),

  setCameraAdjust: (ch, key, value) =>
    set((s) => ({
      cameraAdjust: {
        ...s.cameraAdjust,
        [ch]: {
          ...s.cameraAdjust[ch],
          [key]: Math.max(0, Math.min(200, value)),
        },
      },
    })),
  resetCameraAdjust: (ch) =>
    set((s) => {
      if (ch) {
        return {
          cameraAdjust: {
            ...s.cameraAdjust,
            [ch]: { ...defaultCam[ch] },
          },
        }
      }
      return { cameraAdjust: { ...defaultCam } }
    }),
  setShowCameraSettings: (v) => set({ showCameraSettings: v }),

  bumpZoom: (delta) => {
    const s = get()
    const ch = s.activeCamera === 'MAP' ? null : (s.activeCamera as CameraChannel)
    if (!ch) return
    const spec = CAMERA_ZOOM[ch]
    if (!spec.hasZoom) return
    const cur = s.cameraAdjust[ch].zoom ?? spec.min
    const next = Math.max(spec.min, Math.min(spec.max, +(cur + delta).toFixed(2)))
    set({
      cameraAdjust: {
        ...s.cameraAdjust,
        [ch]: { ...s.cameraAdjust[ch], zoom: next },
      },
      zoom: ch === 'LONG' ? next : s.zoom,
    })
  },

  requestService: () => {
    if (get().serviceUnlocked) set({ showServiceMenu: true, showServicePin: false })
    else set({ showServicePin: true, showServiceMenu: false })
  },
  submitServicePin: (pin) => {
    const expected = String(
      ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SERVICE_PIN) ||
        '12345'
    )
    if (pin.trim() !== expected) {
      get().showToast(get().lang === 'ua' ? 'Невірний пароль' : 'Wrong PIN', 'warn')
      return false
    }
    set({ serviceUnlocked: true, showServicePin: false, showServiceMenu: true })
    return true
  },
  closeServiceUi: () => set({ showServicePin: false, showServiceMenu: false }),
  setFullscreenFlag: (v) => set({ isFullscreen: v }),
  toggleFullscreen: () => {
    const root = document.documentElement
    if (!document.fullscreenElement) void root.requestFullscreen?.()
    else void document.exitFullscreen?.()
  },
  exitFullscreen: () => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
  },

  setGamepadConnected: (v) => set({ gamepadConnected: v }),
  toggleAi: () => {
    const next = !get().aiEnabled
    set({ aiEnabled: next, aiTargets: next ? get().aiTargets : [], aiActiveId: next ? get().aiActiveId : null })
    get().logEvent('CUE_RECEIVED', next ? 'AI overlay ON' : 'AI overlay OFF', 'UI')
  },
  setAiLink: (l) => set({ aiLink: l }),
  applyAiTargets: (boxes, activeId, link) =>
    set((s) => {
      const aid = activeId ?? s.aiActiveId
      const active = boxes.find((b) => b.id === aid) || boxes[0]
      let target = s.target
      if (active && s.aiEnabled && target) {
        target = {
          ...target,
          posX: Math.max(0, Math.min(100, active.leftPct + active.widthPct / 2)),
          posY: Math.max(0, Math.min(100, active.topPct + active.heightPct / 2)),
          classification: active.type || target.classification,
          trackQuality: Math.max(target.trackQuality, 70),
        }
      }
      return {
        aiTargets: boxes,
        aiActiveId: aid,
        aiLink: link ?? s.aiLink,
        target,
      }
    }),
  setAiTracking: (on) => set({ aiTracking: on }),
  startAiDetect: async () => {
    set({ aiEnabled: true })
    const ok = await setBaseTracking(true)
    set({ aiTracking: ok || true })
    get().logEvent('CUE_RECEIVED', 'NN detect / track AUTO', 'UI')
    get().showToast(
      get().lang === 'ua' ? 'Детекція ШІ увімкнена' : 'NN detection ON',
      'info'
    )
  },
  stopAiDetect: async () => {
    await setBaseTracking(false)
    set({ aiTracking: false })
    get().logEvent('CUE_RECEIVED', 'NN detect STOP', 'UI')
  },
  selectAiBox: (id) => {
    const box = get().aiTargets.find((b) => b.id === id)
    set({ aiActiveId: id })
    if (box) {
      const { target, platform, turret } = get()
      const next = target
        ? {
            ...target,
            posX: Math.max(0, Math.min(100, box.leftPct + box.widthPct / 2)),
            posY: Math.max(0, Math.min(100, box.topPct + box.heightPct / 2)),
            classification: box.type || target.classification,
            trackState: 'TRACKING' as const,
            trackQuality: 80,
          }
        : null
      if (next) set({ target: next, automation: 'TRACKING' })
      get().logEvent('TRACK_ACQUIRE', `NN box ${id} ${box.type}`, 'UI', {
        id,
        type: box.type,
        az: turret.az,
        el: turret.el,
      })
      void platform
    }
  },

  /** A-button: mark / (re)acquire target at current aim for MANUAL engagement */
  markTargetAtAim: (source = 'UI') => {
    const { target, platform, turret } = get()
    if (target && (target.trackState === 'TRACKING' || target.trackState === 'COAST')) {
      // Reinforce track
      set({
        target: {
          ...target,
          trackState: 'TRACKING',
          trackQuality: Math.max(target.trackQuality, 80),
          coastTimer: 0,
          azimuth: turret.az,
          elevation: turret.el,
        },
        automation: 'TRACKING',
      })
      get().logEvent('TRACK_ACQUIRE', 'Target marked (aim)', source, {
        az: turret.az,
        el: turret.el,
      })
      return
    }
    // New synthetic track at turret LOS (demo / no external tracker)
    const range = target?.range ?? 1500
    const next = withTargetGps(platform, {
      range,
      azimuth: turret.az,
      elevation: turret.el,
      omegaAz: 0,
      omegaEl: 0,
      classification: target?.classification ?? 'UNKNOWN UAV',
      trackQuality: 75,
      trackState: 'TRACKING' as const,
      coastTimer: 0,
      posX: 50,
      posY: 50,
    })
    set({ target: next, automation: 'TRACKING' })
    get().logEvent('TRACK_ACQUIRE', 'Target marked at aim', source, {
      az: turret.az,
      el: turret.el,
      range,
    })
    get().showToast(
      get().lang === 'ua' ? 'Ціль відмічено' : 'Target marked',
      'info'
    )
  },

  dropTrack: (source = 'UI') => {
    const t = get().target
    if (!t || (t.trackState !== 'TRACKING' && t.trackState !== 'COAST')) return
    if (get().laserStatus === 'FIRING') get().fireEnd(source)
    set({
      laserStatus: 'SAFE',
      armConfirm: false,
      automation: 'SEARCHING',
      aiActiveId: null,
      target: {
        ...t,
        trackState: 'SEARCH',
        trackQuality: 0,
        coastTimer: 0,
        omegaAz: 0,
        omegaEl: 0,
      },
    })
    get().logEvent('TRACK_LOST', 'Track dropped by operator', source, {
      az: t.azimuth,
      el: t.elevation,
    })
    get().showToast(
      get().lang === 'ua' ? 'Трекінг скинуто (RB)' : 'Tracking dropped (RB)',
      'info'
    )
  },

  toggleTrackAtAim: (source = 'UI') => {
    const st = get()
    const t = st.target
    if (t && (t.trackState === 'TRACKING' || t.trackState === 'COAST')) {
      get().dropTrack(source)
      return
    }
    const boxes = st.aiTargets
    if (boxes.length) {
      const nearest = boxes.slice().sort((a, b) => {
        const da = Math.hypot(a.leftPct + a.widthPct / 2 - 50, a.topPct + a.heightPct / 2 - 50)
        const db = Math.hypot(b.leftPct + b.widthPct / 2 - 50, b.topPct + b.heightPct / 2 - 50)
        return da - db
      })[0]
      get().selectAiBox(nearest.id)
      get().showToast(
        st.lang === 'ua' ? `Захват ШІ ${nearest.type || nearest.id}` : `AI lock ${nearest.type || nearest.id}`,
        'ok'
      )
      return
    }
    get().markTargetAtAim(source)
  },

  slewTurret: (dAz, dEl) => {
    const { turret, mode } = get()
    if (mode === 'AUTO') return
    const az = (turret.az + dAz + 360) % 360
    const el = Math.max(-90, Math.min(90, turret.el + dEl))
    set({ turret: { ...turret, az, el, azRate: dAz * 10, elRate: dEl * 10 } })
    if (panoptesConfig.useRealTurret) {
      const panN = Math.max(-1, Math.min(1, dAz / 2.5))
      const tiltN = Math.max(-1, Math.min(1, dEl / 1.5))
      const ctl = getPanoptesController()
      if (Math.abs(panN) < 0.02 && Math.abs(tiltN) < 0.02) ctl.stop()
      else ctl.move(panN, tiltN)
    }
  },
  stopTurretSlew: () => {
    set((s) => ({ turret: { ...s.turret, azRate: 0, elRate: 0 } }))
    if (panoptesConfig.useRealTurret) getPanoptesController().stop()
  },
  setTurretLink: (l) => set({ turretLink: l }),
  applyTurretTelemetry: (t) => {
    set((s) => ({
      turretLink: t.link,
      turret: {
        ...s.turret,
        az: t.pan,
        el: t.tilt,
        azRate: 0,
        elRate: 0,
      },
      turretImu: t.imu
        ? { roll: t.imu.roll, pitch: t.imu.pitch, yaw: t.imu.yaw }
        : s.turretImu,
      platform: (() => {
        if (!t.gps) {
          if (t.link !== 'OK') return { ...s.platform, fix: 'NONE' as const, sats: 0 }
          return s.platform
        }
        const now = Date.now()
        const sats = Number.isFinite(t.gps.sats) ? t.gps.sats : 0
        if (t.gps.valid && t.gps.fix && sats >= 4) {
          return {
            ...s.platform,
            lat: t.gps.lat,
            lon: t.gps.lon,
            fix: '3D' as const,
            sats,
          }
        }
        const stale = !s.gpsLastGoodAt || now - s.gpsLastGoodAt > 8000
        return {
          ...s.platform,
          sats,
          fix: stale || sats < 4 || !t.gps.fix ? 'NONE' as const : s.platform.fix,
        }
      })(),
      gpsLastGoodAt: t.gps?.valid ? Date.now() : s.gpsLastGoodAt,
    }))
  },
  turretGoto: async (pan, tilt) => {
    if (!panoptesConfig.useRealTurret) {
      set((s) => ({ turret: { ...s.turret, az: pan, el: tilt } }))
      return
    }
    await getPanoptesController().goto(pan, tilt)
  },
  turretHome: async () => {
    if (!panoptesConfig.useRealTurret) {
      set((s) => ({ turret: { ...s.turret, az: 0, el: 0 } }))
      return
    }
    await getPanoptesController().home()
  },
  turretEStop: async () => {
    getPanoptesController().stop()
    if (panoptesConfig.useRealTurret) await getPanoptesController().emergencyStop()
    get().safe('SYSTEM')
  },
  setTurret: (az, el) =>
    set({
      turret: {
        az: (az + 360) % 360,
        el: Math.max(-10, Math.min(70, el)),
        azRate: 0,
        elRate: 0,
      },
    }),

  slewToCue: (cueId, source = 'UI') => {
    const { cues, mode } = get()
    const cue = cues.find((c) => c.id === cueId)
    if (!cue) return
    if (panoptesConfig.useRealTurret) {
      void getPanoptesController().goto(cue.azimuth, cue.elevation)
    }
    set({
      turret: { az: cue.azimuth, el: cue.elevation, azRate: 0, elRate: 0 },
      cues: cues.map((c) =>
        c.id === cueId ? { ...c, status: 'SLEWING' as const } : c
      ),
      automation: 'SLEWING',
      // Cue handoff implies SEMI unless already AUTO
      mode: mode === 'AUTO' ? 'AUTO' : 'SEMI',
    })
    get().logEvent('SLEW', `Slew to ${cueId}`, source, {
      az: cue.azimuth,
      el: cue.elevation,
      range: cue.range ?? 0,
    })
    setTimeout(() => {
      const state = get()
      set({
        cues: state.cues.map((c) =>
          c.id === cueId ? { ...c, status: 'ACQUIRED' as const } : c
        ),
        automation: state.target?.trackState === 'TRACKING' ? 'TRACKING' : 'SEARCHING',
      })
    }, 1200)
  },
  dismissCue: (cueId) =>
    set((s) => ({
      cues: s.cues.map((c) =>
        c.id === cueId ? { ...c, status: 'DROPPED' as const } : c
      ),
    })),
  tickCues: () =>
    set((s) => ({
      cues: s.cues.map((c) => ({
        ...c,
        ageSec: c.ageSec + 1,
        status:
          c.status === 'DROPPED' || c.status === 'ACQUIRED'
            ? c.status
            : c.ageSec + 1 > 30
              ? 'STALE'
              : c.status,
      })),
    })),

  toggleRecording: () => {
    const st = get()
    if (!st.recording) {
      const sid = get().ensureArchiveSession()
      const profile = st.recordingProfile
      const channels = activeChannelList(profile.channels)
      if (channels.length === 0) {
        get().showToast(
          st.lang === 'ua' ? 'Оберіть хоча б один канал запису' : 'Select at least one record channel',
          'warn'
        )
        return
      }
      const caps = getMediaRecorder().getCaps()
      set({
        recording: true,
        recordingStartedAt: Date.now(),
        recordingChannels: channels,
        recordingActualCodec: caps.metaOnly ? 'meta' : profile.codec,
      })
      void (async () => {
        try {
          await getMediaRecorder().start({
            sessionId: sid,
            channels,
            codec: profile.codec,
            segmentDurationSec: profile.segmentDurationSec,
            bitrates: profile.bitrates,
            prerollSec: profile.prerollSec,
          })
          const actual = getMediaRecorder().getActualCodec()
          set({ recordingActualCodec: actual === 'h265' || actual === 'h264' ? actual : 'meta' })
          get().logEvent(
            'REC_START',
            `REC start ${channels.join('+')} · target ${profile.codec.toUpperCase()} · actual ${String(actual).toUpperCase()}`,
            'UI',
            {
              channels: channels.join(','),
              codec_target: profile.codec,
              codec_actual: actual,
              preset: profile.mode,
            }
          )
          if (getMediaRecorder().getCaps().metaOnly) {
            const preroll = (profile.prerollSec ?? 15) * 1000
            const mono = archiveMock.getSessionMonoMs(sid)
            for (const ch of channels) {
              archiveMock.attachMediaRef({
                ts_utc: new Date().toISOString(),
                t_mono_ms: Math.max(0, mono - preroll),
                channel: ch,
                kind: 'SEGMENT',
                label: `PREROLL ${ch} −${profile.prerollSec ?? 15}s from ring`,
                codec: profile.codec,
                container: 'mp4',
                duration_ms: preroll,
              })
            }
          }
        } catch (e) {
          set({ recording: false, recordingStartedAt: null, recordingActualCodec: 'meta' })
          get().showToast(
            get().lang === 'ua'
              ? `REC помилка: ${e instanceof Error ? e.message : String(e)}`
              : `REC error: ${e instanceof Error ? e.message : String(e)}`,
            'error'
          )
        }
      })()
      return
    }
    // stop — keep the same archive session id that start() used
    const started = st.recordingStartedAt ?? Date.now()
    const durationSec = Math.max(1, Math.round((Date.now() - started) / 1000))
    const sid = archiveMock.getActiveSessionId()
    get().logEvent('REC_STOP', `REC stop ${st.recordingChannels.join('+')}`, 'UI', {
      channels: st.recordingChannels.join(','),
      codec_actual: st.recordingActualCodec,
      durationSec,
    })
    set({
      recording: false,
      recordingStartedAt: null,
      recordingActualCodec: st.recordingActualCodec === 'meta' ? 'meta' : st.recordingActualCodec,
    })
    void (async () => {
      try {
        const refs = await getMediaRecorder().stop()
        if (sid) {
          for (const r of refs) {
            archiveMock.attachMediaRef({ ...r, session_id: sid })
          }
          archiveMock.stopSession(sid)
        }
        get().showToast(
          get().lang === 'ua'
            ? `Сесія ${sid || ''} · ${refs.length} файлів`
            : `Session ${sid || ''} · ${refs.length} files`,
          'ok'
        )
      } catch (e) {
        get().showToast(e instanceof Error ? e.message : String(e), 'error')
      }
    })()
  },
  stopRecording: () => {
    if (get().recording) get().toggleRecording()
  },
  setRecordingPreset: (mode) => {
    if (get().recording) {
      get().showToast(
        get().lang === 'ua' ? 'Зупиніть REC, щоб змінити пресет' : 'Stop REC to change preset',
        'warn'
      )
      return
    }
    const channels = channelsFromPreset(mode, get().recordingProfile.channels)
    set({
      recordingProfile: { ...get().recordingProfile, mode, channels },
      recordingChannels: activeChannelList(channels),
    })
  },
  setRecChannel: (ch, on) => {
    if (get().recording) {
      get().showToast(
        get().lang === 'ua' ? 'Зупиніть REC, щоб змінити канали' : 'Stop REC to change channels',
        'warn'
      )
      return
    }
    const channels = { ...get().recordingProfile.channels, [ch]: on }
    set({
      recordingProfile: {
        ...get().recordingProfile,
        mode: 'CUSTOM',
        channels,
      },
      recordingChannels: activeChannelList(channels),
    })
  },
  setRecordingCodec: (c) => {
    if (get().recording) {
      get().showToast(
        get().lang === 'ua' ? 'Зупиніть REC, щоб змінити кодек' : 'Stop REC to change codec',
        'warn'
      )
      return
    }
    set({ recordingProfile: { ...get().recordingProfile, codec: c } })
  },
  tickRecordingSegments: () => {
    if (!get().recording) return
    getMediaRecorder().tickSegment?.()
  },
  snapshotRecording: (trigger, eventId) => {
    const st = get()
    if (!st.recording && !archiveMock.getActiveSessionId()) return
    const on = st.recordingProfile.autoSnapshotOn as string[]
    // Map trigger names
    const key = trigger === 'FIRE_START' || trigger === 'FIRE_END' || trigger === 'ARM' || trigger === 'TRACK_LOST'
      ? trigger
      : trigger
    if (st.recording && !on.includes(key as 'ARM')) {
      // still allow explicit FIRE/LOST from safety path
      if (!['FIRE_START', 'FIRE_END', 'ARM', 'TRACK_LOST'].includes(trigger)) return
    }
    const chans = st.recording
      ? st.recordingChannels
      : activeChannelList(st.recordingProfile.channels)
    for (const ch of chans.length ? chans : (['LONG'] as CameraChannel[])) {
      void getMediaRecorder().snapshot(ch, eventId, `${trigger} · ${ch}`)
    }
  },

  pollSidecar: async () => {
    const st = await HttpMediaRecorder.fetchStatus()
    if (!st) {
      set({ sidecarConnected: false, ringHot: getMediaRecorder().getCaps().metaOnly ? get().ringHot : false })
      return
    }
    const streams = (st as { streams?: Record<string, string | null> }).streams || {}
    const mdns = Object.values(streams).some((u) => typeof u === 'string' && u.includes('.local'))
    if (!st.ringHot || mdns) {
      await HttpMediaRecorder.discover(undefined, false)
    }
    const files = await HttpMediaRecorder.fetchRingIndex()
    if (files.length) {
      archiveMock.ensureNamedSession('RING', 'Always-on 90s camera ring · H.264', ['LONG', 'IR'])
      archiveMock.replaceSessionMedia(
        'RING',
        files.map((f) => ({
          id: f.id || `RING-${f.channel}`,
          ts_utc: new Date().toISOString(),
          t_mono_ms: f.t_mono_ms || 0,
          session_id: 'RING',
          channel: (f.channel as 'LONG' | 'IR' | 'WIDE') || 'LONG',
          kind: 'SEGMENT',
          label: f.file || f.path || f.channel,
          codec: 'h264',
          container: 'mp4',
          url: absMediaUrl(f.url),
          path: f.path,
        }))
      )
    }
    try {
      const liveRefs = await HttpMediaRecorder.fetchSessionIndex('LIVE')
      if (liveRefs.length) {
        archiveMock.ensureNamedSession('LIVE', 'Continuous H.264 from cameras', ['LONG', 'IR'])
        archiveMock.replaceSessionMedia('LIVE', liveRefs)
      }
    } catch { /* sidecar older than this build */ }
    const recSid = archiveMock.getActiveSessionId()
    if (recSid && recSid !== 'LIVE' && recSid !== 'RING') {
      try {
        const sesRefs = await HttpMediaRecorder.fetchSessionIndex(recSid)
        if (sesRefs.length) archiveMock.replaceSessionMedia(recSid, sesRefs)
      } catch { /* */ }
    }
    set({
      sidecarConnected: true,
      ringHot: !!st.ringHot,
      mediaRoot: st.mediaRoot || get().mediaRoot,
      recordingActualCodec: get().recording ? get().recordingActualCodec : files.length ? 'h264' : get().recordingActualCodec,
    })
  },

  exportEngagementClip: async (sessionId, channel = 'LONG') => {
    const rec = getMediaRecorder()
    const bundle = archiveMock.getSession(sessionId)
    const eng = bundle?.engagements[0]
    const recStart = bundle?.events.find((e) => e.type === 'REC_START')?.t_mono_ms ?? 0
    const tStart = Math.max(0, recStart - 15_000)
    const tEnd = eng
      ? (eng.ended_at
          ? new Date(eng.ended_at).getTime() - new Date(bundle!.session.started_at).getTime()
          : tStart + 40_000)
      : tStart + 40_000
    if (typeof rec.clip === 'function') {
      const ref = await rec.clip({
        sessionId,
        channel,
        tStartMs: tStart,
        tEndMs: tEnd,
        label: `ENG_T-15_T+25_${channel.toLowerCase()}`,
      })
      if (ref?.url) {
        get().showToast(get().lang === 'ua' ? `Кліп записано: ${ref.label}` : `Clip written: ${ref.label}`, 'ok')
        return ref.url
      }
    }
    return null
  },

  refreshTargetGps: () => {
    const { target, platform } = get()
    if (!target) return
    set({ target: withTargetGps(platform, target) })
  },

  activateEffector: (id) => {
    if (id === 'LASER') {
      get().showToast(get().lang === 'ua' ? 'Використовуйте SAFE/ARM/FIRE' : 'Use SAFE/ARM/FIRE chain', 'warn')
      return
    }
    const eff = get().effectors.find((e) => e.id === id)
    const msg =
      !eff || eff.status === 'NOT_FITTED'
        ? `${id} NOT FITTED`
        : `${id} ${eff.status}`
    get().showToast(msg, 'warn')
    get().logEvent('EFFECTOR', msg, 'UI', { effector: id })
  },

  exportEventLogJson: () => JSON.stringify(get().eventLog, null, 2),
  exportEventLogCsv: () => {
    const rows = get().eventLog
    const header = 'id,ts,type,source,message'
    const lines = rows.map(
      (e) =>
        `${e.id},${e.ts},${e.type},${e.source},"${String(e.message).replace(/"/g, '""')}"`
    )
    return [header, ...lines].join('\n')
  },

  ensureArchiveSession: () => {
    const existing = archiveMock.getActiveSessionId()
    if (existing) return existing
    const st = get()
    return archiveMock.startSession({
      operator_note: 'Live operator session',
      channels: ['LONG', 'WIDE', 'IR'],
      software_version: SW_VERSION,
      layout_profile: st.layoutProfile,
      parallax: st.parallax,
      calibration_status: st.calibrationStatus,
      active_camera: String(st.activeCamera),
    })
  },
  sealArchiveSession: () => {
    const id = archiveMock.getActiveSessionId()
    if (id) archiveMock.sealSession(id)
  },
  deleteArchiveSession: (id) => {
    if (get().laserStatus !== 'SAFE') return false
    return archiveMock.deleteSession(id)
  },
  exportArchiveSessionJson: (id) => archiveMock.exportSessionJson(id),
  exportArchiveSessionCsv: (id) => archiveMock.exportSessionCsv(id),
  listArchiveSessions: () => archiveMock.listSessions(),
  getArchiveBundle: (id) => archiveMock.getSession(id),
  archiveTickTelemetry: () => {
    if (!archiveMock.getActiveSessionId()) return
    const st = get()
    const lt = st.laserTelemetry
    const ilk =
      lt.interlocks.keySwitch &&
      lt.interlocks.eStop &&
      lt.interlocks.cover &&
      lt.interlocks.coolant &&
      lt.interlocks.door &&
      lt.interlocks.overTemp
    archiveMock.appendTelemetry({
      laser_status: st.laserStatus,
      mode: st.mode,
      wavelength_nm: lt.wavelengthNm,
      energy_set_j: lt.energySetJ,
      energy_meas_mj: lt.energyMeas_mJ,
      rep_rate_hz: lt.repRateHz,
      temp_head_c: lt.tempHeadC,
      temp_psu_c: lt.tempPsuC,
      temp_coolant_c: lt.tempCoolantC,
      interlocks_ok: ilk,
      link_ok: lt.linkOk,
      shot_user: lt.shotUser,
      turret_az: st.turret.az,
      turret_el: st.turret.el,
      platform_lat: st.platform.lat,
      platform_lon: st.platform.lon,
      platform_alt: st.platform.alt,
      track_state: st.target?.trackState ?? null,
      track_range_m: st.target?.range ?? null,
      track_quality: st.target?.trackQuality ?? null,
    })
  },

  refreshLaserTelemetry: async () => {
    const tel = await quantelMock.readTelemetry()
    set({
      laserTelemetry: tel,
      extras: {
        tempLaser: tel.tempHeadC,
        tempBoard: tel.tempPsuC,
        pulseCount: tel.shotUser,
      },
    })
  },
  laserSimmer: async () => {
    if (get().laserStatus !== 'SAFE') {
      get().showToast('Laser must be SAFE', 'warn')
      return
    }
    const r = await quantelMock.simmer()
    await get().refreshLaserTelemetry()
    get().logEvent('EFFECTOR', `SIMMER ${r.message}`, 'UI')
    if (!r.ok) get().showToast(r.message, 'error')
  },
  laserStandby: async () => {
    const r = await quantelMock.standby()
    await get().refreshLaserTelemetry()
    get().logEvent('SAFE', `STANDBY ${r.message}`, 'UI')
  },
  setLaserEnergyJ: async (j) => {
    if (get().laserStatus !== 'SAFE') {
      get().showToast('Set energy only in SAFE', 'warn')
      return
    }
    const r = await quantelMock.setEnergyJ(j)
    await get().refreshLaserTelemetry()
    get().logEvent('EFFECTOR', r.message, 'UI', { energyJ: j })
    if (!r.ok) get().showToast(r.message, 'error')
  },
  setLaserRepRateHz: async (hz) => {
    if (get().laserStatus !== 'SAFE') {
      get().showToast('Set rate only in SAFE', 'warn')
      return
    }
    const r = await quantelMock.setRepRateHz(hz)
    await get().refreshLaserTelemetry()
    get().logEvent('EFFECTOR', r.message, 'UI', { rateHz: hz })
    if (!r.ok) get().showToast(r.message, 'error')
  },
  setLaserWavelength: async (nm) => {
    if (get().laserStatus !== 'SAFE') {
      get().showToast('Set λ only in SAFE', 'warn')
      return
    }
    const r = await quantelMock.setWavelength(nm)
    await get().refreshLaserTelemetry()
    get().logEvent('EFFECTOR', r.message, 'UI', { wavelengthNm: nm })
  },
  setLaserAttenuator: async (pct) => {
    if (get().laserStatus === 'FIRING') {
      get().showToast('No attenuator change while FIRING', 'warn')
      return
    }
    const r = await quantelMock.setAttenuatorPct(pct)
    await get().refreshLaserTelemetry()
    get().logEvent('EFFECTOR', r.message, 'UI', { attenuatorPct: pct })
  },
  resetLaserUserCounter: async () => {
    if (get().laserStatus !== 'SAFE') return
    const r = await quantelMock.resetUserCounter()
    await get().refreshLaserTelemetry()
    get().logEvent('BITE', r.message, 'UI')
  },

}))
