/**
 * Integration ports for external C2 / sensors / effectors.
 * Real ONVIF/RTSP/REST backends plug in here later without rewriting UI.
 */

import type { ExternalCue, EffectorId, EffectorStatus, LaserStatus } from '../types/hmi'

export interface ICueSource {
  /** Pull or subscribe to external tracks / cues */
  listCues(): ExternalCue[]
  onCue?(cb: (cue: ExternalCue) => void): () => void
}

export interface EffectorCommand {
  effector: EffectorId
  action: 'ACTIVATE' | 'DEACTIVATE' | 'STATUS'
  params?: Record<string, unknown>
}

export interface IEffector {
  id: EffectorId
  getStatus(): EffectorStatus
  command(cmd: EffectorCommand): Promise<{ ok: boolean; message: string }>
}

export interface IVideoSource {
  channel: 'LONG' | 'WIDE' | 'IR'
  /** URL or handle for stream (MJPEG / HLS / WebRTC) */
  getUrl(): string | null
}

/** REST-like shapes for future C2 bridge */
export interface RestCueBody {
  id: string
  source: string
  az: number
  el: number
  range?: number
  quality?: number
}

export interface RestStatusResponse {
  laser: LaserStatus
  effectors: Record<string, EffectorStatus>
  tracks: number
}

export interface RestEffectorCommand {
  action: 'ACTIVATE' | 'DEACTIVATE'
  params?: Record<string, unknown>
}
