/**
 * Mission-grade archive model for Laser C-UAS HMI.
 * Hierarchy: mission → session → engagement → track → event
 * Four streams: events | telemetry | media | config
 */

import type {
  CameraChannel,
  CalibrationStatus,
  LaserStatus,
  OperationMode,
  ParallaxCoeffs,
  TrackState,
} from './hmi'

export type ArchiveEventType =
  | 'SESSION_START'
  | 'SESSION_STOP'
  | 'MODE_CHANGE'
  | 'TRACK_ACQUIRE'
  | 'TRACK_UPDATE'
  | 'TRACK_COAST'
  | 'TRACK_LOST'
  | 'TRACK_REACQUIRE'
  | 'CUE_RECEIVED'
  | 'CUE_SLEW'
  | 'CUE_DROP'
  | 'LASER_SAFE'
  | 'LASER_ARM'
  | 'LASER_ARM_CONFIRM'
  | 'LASER_FIRE_START'
  | 'LASER_FIRE_END'
  | 'EFFECTOR_CMD'
  | 'CAL_START'
  | 'CAL_STEP'
  | 'CAL_SAVE'
  | 'CAL_ABORT'
  | 'BITE_RUN'
  | 'BITE_RESULT'
  | 'REC_START'
  | 'REC_STOP'
  | 'INTERLOCK_CHANGE'
  | 'LINK_CHANGE'
  | 'OPERATOR_NOTE'
  | 'SYSTEM_WARN'
  | 'SYSTEM_FAULT'

export type ArchiveEventSource = 'OPERATOR' | 'SYSTEM' | 'EXTERNAL' | 'SAFETY'

export type ArchiveEventResult = 'OK' | 'DENIED' | 'FAILED' | 'N/A'

export type EngagementResult =
  | 'KILL_SOFT'
  | 'NO_EFFECT'
  | 'ABORT'
  | 'UNKNOWN'

export interface ArchiveEvent {
  id: string
  ts_utc: string
  t_mono_ms: number
  type: ArchiveEventType
  source: ArchiveEventSource
  session_id: string
  engagement_id?: string
  track_id?: string
  message: string
  payload?: Record<string, string | number | boolean | null>
  result: ArchiveEventResult
}

export interface TelemetrySample {
  ts_utc: string
  t_mono_ms: number
  session_id: string
  laser_status: LaserStatus
  mode: OperationMode
  wavelength_nm?: number
  energy_set_j?: number
  energy_meas_mj?: number | null
  rep_rate_hz?: number
  temp_head_c?: number
  temp_psu_c?: number
  temp_coolant_c?: number
  interlocks_ok?: boolean
  link_ok?: boolean
  shot_user?: number
  turret_az?: number
  turret_el?: number
  platform_lat?: number
  platform_lon?: number
  platform_alt?: number
  track_state?: TrackState | null
  track_range_m?: number | null
  track_quality?: number | null
}

export type MediaCodec = 'h265' | 'h264' | 'jpeg' | 'meta'
export type MediaContainer = 'mp4' | 'ts' | 'mkv' | 'none'

export interface MediaRef {
  id: string
  ts_utc: string
  t_mono_ms: number
  session_id: string
  channel: CameraChannel | 'COMPOSITE'
  kind: 'SEGMENT' | 'SNAPSHOT' | 'CLIP'
  trigger_event_id?: string
  /** Demo: no real blob — path/label only */
  label: string
  url?: string
  duration_ms?: number
  codec: MediaCodec
  container?: MediaContainer
  width?: number
  height?: number
  fps?: number
  bitrate_kbps?: number
  hw_encoder?: boolean
}

export type RecordingPreset = 'ALL' | 'COMBAT' | 'ACQ' | 'CUSTOM' | 'ON_ENGAGEMENT'

export interface RecordingChannels {
  LONG: boolean
  WIDE: boolean
  IR: boolean
}

export interface RecordingProfile {
  mode: RecordingPreset
  channels: RecordingChannels
  /** Target codec for production; demo always records meta index */
  codec: 'h265' | 'h264'
  segmentDurationSec: number
  bitrates?: Partial<Record<CameraChannel, number>>
  autoSnapshotOn: Array<'ARM' | 'FIRE_START' | 'FIRE_END' | 'TRACK_LOST'>
  prerollSec: number
}

export const DEFAULT_RECORDING_PROFILE: RecordingProfile = {
  mode: 'COMBAT',
  channels: { LONG: true, WIDE: false, IR: true },
  codec: 'h265',
  segmentDurationSec: 15,
  bitrates: { LONG: 6000, WIDE: 3000, IR: 2000 },
  autoSnapshotOn: ['ARM', 'FIRE_START', 'FIRE_END', 'TRACK_LOST'],
  prerollSec: 15,
}

export function channelsFromPreset(
  mode: RecordingPreset,
  custom?: RecordingChannels
): RecordingChannels {
  switch (mode) {
    case 'ALL':
      return { LONG: true, WIDE: true, IR: true }
    case 'COMBAT':
      return { LONG: true, WIDE: false, IR: true }
    case 'ACQ':
      return { LONG: false, WIDE: true, IR: false }
    case 'ON_ENGAGEMENT':
      return custom ?? { LONG: true, WIDE: false, IR: true }
    case 'CUSTOM':
    default:
      return custom ?? { LONG: true, WIDE: false, IR: true }
  }
}

export function activeChannelList(ch: RecordingChannels): CameraChannel[] {
  const out: CameraChannel[] = []
  if (ch.LONG) out.push('LONG')
  if (ch.WIDE) out.push('WIDE')
  if (ch.IR) out.push('IR')
  return out
}

export interface ConfigSnapshot {
  ts_utc: string
  t_mono_ms: number
  session_id: string
  software_version: string
  layout_profile: string
  parallax: ParallaxCoeffs
  calibration_status: CalibrationStatus
  active_camera: string
  note?: string
}

export interface Engagement {
  id: string
  session_id: string
  track_id?: string
  started_at: string
  ended_at?: string
  duration_sec: number
  classification: string
  range_min_m: number
  range_max_m: number
  max_quality: number
  shots_fired: number
  modes_used: OperationMode[]
  result: EngagementResult
  event_ids: string[]
}

export interface ArchiveSession {
  id: string
  mission_id: string
  started_at: string
  ended_at?: string
  duration_sec: number
  operator_note: string
  sealed: boolean
  recording: boolean
  channels: CameraChannel[]
  software_version: string
  event_count: number
  engagement_count: number
  had_fire: boolean
  modes: OperationMode[]
}

export interface Mission {
  id: string
  name: string
  created_at: string
  session_ids: string[]
}

export interface SessionBundle {
  session: ArchiveSession
  events: ArchiveEvent[]
  telemetry: TelemetrySample[]
  media: MediaRef[]
  config: ConfigSnapshot[]
  engagements: Engagement[]
}

export interface ArchiveEventFilter {
  session_id?: string
  types?: ArchiveEventType[]
  from_utc?: string
  to_utc?: string
  had_fire_only?: boolean
}

export interface SessionStartMeta {
  mission_id?: string
  operator_note?: string
  channels?: CameraChannel[]
  software_version: string
  layout_profile: string
  parallax: ParallaxCoeffs
  calibration_status: CalibrationStatus
  active_camera: string
}
