import type { ArchiveEvent, SessionBundle, TelemetrySample } from '../types/archive'
import type { CameraChannel, LaserStatus, TrackState } from '../types/hmi'

export interface ReplayHud {
  laser: LaserStatus
  track: TrackState
  range: number
  az: number
  el: number
  quality: number
  classification: string
  recording: boolean
  coast: number
}

function lastOf(events: ArchiveEvent[], t: number, types: string[]): ArchiveEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.t_mono_ms <= t && types.includes(e.type)) return e
  }
  return undefined
}

function nearestTel(samples: TelemetrySample[], t: number): TelemetrySample | undefined {
  if (!samples.length) return undefined
  let best = samples[0]
  let d = Math.abs(best.t_mono_ms - t)
  for (const s of samples) {
    const n = Math.abs(s.t_mono_ms - t)
    if (n < d) {
      best = s
      d = n
    }
  }
  return best
}

export function hudFromBundle(bundle: SessionBundle, t: number): ReplayHud {
  const ev = bundle.events
  const tel = nearestTel(bundle.telemetry, t)
  const acq = lastOf(ev, t, ['TRACK_ACQUIRE', 'TRACK_REACQUIRE'])
  const lost = lastOf(ev, t, ['TRACK_LOST', 'TRACK_COAST'])
  let track: TrackState = 'SEARCH'
  let coast = 0
  if (acq && (!lost || acq.t_mono_ms >= lost.t_mono_ms)) track = 'TRACKING'
  else if (lost?.type === 'TRACK_COAST' && t - lost.t_mono_ms < 8000) {
    track = 'COAST'
    coast = Math.max(0, 8 - Math.floor((t - lost.t_mono_ms) / 1000))
  } else if (lost) track = 'LOST'

  let laser: LaserStatus = 'SAFE'
  const fireS = lastOf(ev, t, ['LASER_FIRE_START'])
  const fireE = lastOf(ev, t, ['LASER_FIRE_END'])
  const arm = lastOf(ev, t, ['LASER_ARM'])
  const safe = lastOf(ev, t, ['LASER_SAFE'])
  if (fireS && (!fireE || fireS.t_mono_ms > fireE.t_mono_ms)) laser = 'FIRING'
  else if (safe && (!arm || safe.t_mono_ms > arm.t_mono_ms)) laser = 'SAFE'
  else if (arm && (!safe || arm.t_mono_ms > safe.t_mono_ms)) laser = 'ARMED'

  const recS = lastOf(ev, t, ['REC_START'])
  const recE = lastOf(ev, t, ['REC_STOP'])
  const recording = !!(recS && (!recE || recS.t_mono_ms > recE.t_mono_ms))

  const eng = bundle.engagements.find((e) => {
    const t1 = e.ended_at
      ? new Date(e.ended_at).getTime() - new Date(bundle.session.started_at).getTime()
      : bundle.session.duration_sec * 1000
    const t0 = new Date(e.started_at).getTime() - new Date(bundle.session.started_at).getTime()
    return t >= t0 && t <= t1
  })

  let range = tel?.track_range_m ?? 0
  if (!range && eng) {
    const t0 = new Date(eng.started_at).getTime() - new Date(bundle.session.started_at).getTime()
    const t1 = eng.ended_at
      ? new Date(eng.ended_at).getTime() - new Date(bundle.session.started_at).getTime()
      : t0 + eng.duration_sec * 1000
    const u = (t - t0) / Math.max(1, t1 - t0)
    range = eng.range_max_m + (eng.range_min_m - eng.range_max_m) * Math.min(1, Math.max(0, u))
  }

  const tSec = t / 1000
  return {
    laser,
    track,
    range,
    az: tel?.turret_az ?? 127.4 + Math.sin(tSec * 0.35) * 1.8,
    el: tel?.turret_el ?? 8.2 + Math.sin(tSec * 0.22) * 0.7,
    quality:
      tel?.track_quality ??
      (track === 'TRACKING' ? Math.round(88 + Math.sin(tSec) * 6) : track === 'COAST' ? 22 : 0),
    classification: eng?.classification ?? String(acq?.payload?.class ?? acq?.payload?.classification ?? 'UAV'),
    recording,
    coast,
  }
}

export function eventColor(type: string): string {
  if (type.includes('FIRE') || type.includes('FAULT') || type.includes('LOST')) return 'text-[#F85149]'
  if (type.includes('ARM') || type.includes('WARN') || type.includes('COAST') || type.includes('CUE'))
    return 'text-[#D29922]'
  if (type.includes('TRACK') || type.includes('SAFE') || type.includes('ACQUIRE')) return 'text-[#3FB950]'
  return 'text-[#58A6FF]'
}

export function eventMarker(type: string): string {
  if (type.includes('FIRE_START')) return 'F'
  if (type.includes('ARM')) return 'A'
  if (type.includes('ACQUIRE') || type.includes('REACQUIRE')) return 'T'
  if (type.includes('CUE')) return 'C'
  if (type.includes('LOST') || type.includes('COAST')) return 'L'
  if (type.includes('REC')) return 'R'
  if (type.includes('SAFE')) return 'S'
  return '·'
}

export function fmtClock(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const s = Math.floor(abs / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const cs = Math.floor((abs % 1000) / 100)
  return `${sign}${m}:${sec.toString().padStart(2, '0')}.${cs}`
}

export type ReplayChannel = CameraChannel
