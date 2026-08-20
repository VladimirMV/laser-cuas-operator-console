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
} from '../types/hmi'
import { fitParallax } from '../lib/utils'
import { destinationPoint } from '../lib/geo'
import { quantelMock, createDefaultLaserTelemetry } from '../adapters/laser'

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
  turret: TurretState
  cameraAdjust: CameraAdjustMap
  cues: ExternalCue[]
  sessions: SessionRecord[]
  recording: boolean
  recordingStartedAt: number | null
  recordingChannels: CameraChannel[]
  showCameraSettings: boolean

  /** Live event log (always on, even without REC) */
  eventLog: EventLogEntry[]
  effectors: EffectorState[]
  layoutProfile: LayoutProfile
  mapTrackUp: boolean
  toast: ToastMsg | null
  selectedSessionId: string | null

  setLaserStatus: (s: LaserStatus) => void
  setMode: (m: OperationMode, source?: EventSource) => void
  setActiveCamera: (c: MainView) => void
  setZoom: (z: number) => void
  setScreen: (s: AppScreen) => void
  setArmConfirm: (v: boolean) => void
  setLang: (l: Lang) => void
  toggleLang: () => void
  setLayoutProfile: (p: LayoutProfile) => void
  setMapTrackUp: (v: boolean) => void
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
  finishCalibration: () => void
  cancelCalibration: () => void
  runBite: () => void
  closeBite: () => void

  setCameraAdjust: (ch: CameraChannel, key: 'brightness' | 'contrast', value: number) => void
  resetCameraAdjust: (ch?: CameraChannel) => void
  setShowCameraSettings: (v: boolean) => void
  slewTurret: (dAz: number, dEl: number) => void
  setTurret: (az: number, el: number) => void
  slewToCue: (cueId: string, source?: EventSource) => void
  dismissCue: (cueId: string) => void
  tickCues: () => void
  toggleRecording: () => void
  stopRecording: () => void
  refreshTargetGps: () => void

  /** Soft-kill ladder stubs */
  activateEffector: (id: EffectorId) => void
  exportEventLogJson: () => string
  exportEventLogCsv: () => string

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
  trackQuality: 94,
  trackState: 'TRACKING',
  coastTimer: 0,
  posX: 52,
  posY: 44,
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
  LONG: { brightness: 100, contrast: 100 },
  WIDE: { brightness: 100, contrast: 100 },
  IR: { brightness: 110, contrast: 120 },
}

const defaultPlatform: PlatformGps = {
  lat: 48.4501,
  lon: 34.9833,
  alt: 78,
  heading: 42,
  fix: '3D',
  sats: 14,
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

function loadLayout(): LayoutProfile {
  try {
    const v = localStorage.getItem('hmi-layout')
    if (v === 'laptop' || v === 'soc' || v === 'vehicle') return v
  } catch { /* SSR / private mode */ }
  return 'soc'
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
  automation: 'TRACKING',
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
  lang: 'ua',
  biteItems: defaultBite,
  biteRunning: false,

  platform: defaultPlatform,
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
  recordingChannels: ['LONG', 'WIDE', 'IR'],
  showCameraSettings: false,

  eventLog: sampleLog,
  effectors: defaultEffectors,
  layoutProfile: loadLayout(),
  mapTrackUp: false,
  toast: null,
  selectedSessionId: null,

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
  setLang: (l) => set({ lang: l }),
  toggleLang: () => set((s) => ({ lang: s.lang === 'ua' ? 'en' : 'ua' })),
  setLayoutProfile: (p) => {
    try { localStorage.setItem('hmi-layout', p) } catch { /* */ }
    set({ layoutProfile: p })
  },
  setMapTrackUp: (v) => set({ mapTrackUp: v }),
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
  },

  arm: (source = 'UI') => {
    const { laserStatus, target } = get()
    if (laserStatus !== 'SAFE') return
    if (!target || target.trackState !== 'TRACKING') return
    set({ armConfirm: true, automation: 'WAITING_CONFIRM' })
  },
  confirmArm: (source = 'UI') => {
    const { target } = get()
    if (!target || target.trackState !== 'TRACKING') {
      set({ armConfirm: false })
      return
    }
    set({ laserStatus: 'ARMED', armConfirm: false, automation: 'TRACKING' })
    get().logEvent('ARM', 'Laser ARMED', source, { range: target.range })
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
    set((s) => ({ calMeasurements: [...s.calMeasurements, m] })),
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
        systemStatus: 'OK',
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
            [ch]: { brightness: 100, contrast: 100 },
          },
        }
      }
      return { cameraAdjust: { ...defaultCam } }
    }),
  setShowCameraSettings: (v) => set({ showCameraSettings: v }),

  slewTurret: (dAz, dEl) => {
    const { turret, mode } = get()
    // MANUAL: full control. SEMI: allow fine slew. AUTO: inhibited
    if (mode === 'AUTO') return
    const az = (turret.az + dAz + 360) % 360
    const el = Math.max(-10, Math.min(70, turret.el + dEl))
    set({ turret: { ...turret, az, el, azRate: dAz * 10, elRate: dEl * 10 } })
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
    const { recording, recordingStartedAt, sessions, recordingChannels, eventLog } = get()
    if (!recording) {
      set({ recording: true, recordingStartedAt: Date.now() })
      get().logEvent('REC_START', 'Recording started', 'UI')
      return
    }
    const started = recordingStartedAt ?? Date.now()
    const durationSec = Math.max(1, Math.round((Date.now() - started) / 1000))
    const id = `SES-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
    // Snapshot recent events into this session
    const sessionEvents = eventLog.filter(
      (e) => new Date(e.ts).getTime() >= started
    )
    const rec: SessionRecord = {
      id,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date().toISOString(),
      durationSec,
      channels: [...recordingChannels],
      events: sessionEvents.length,
      note: 'Operator recording',
      recording: false,
      eventLog: sessionEvents,
    }
    get().logEvent('REC_STOP', 'Recording stopped', 'UI')
    set({
      recording: false,
      recordingStartedAt: null,
      sessions: [rec, ...sessions],
    })
  },
  stopRecording: () => {
    if (get().recording) get().toggleRecording()
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
    const rows = [['ts', 'type', 'source', 'message'].join(',')]
    for (const e of get().eventLog) {
      rows.push(
        [e.ts, e.type, e.source, `"${e.message.replace(/"/g, '""')}"`].join(',')
      )
    }
    return rows.join('\n')
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
