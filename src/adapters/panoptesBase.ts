/**
 * Panoptes-base HTTP: AI tracker + station status (index1.html).
 * POST /track/auto | /track/stop
 * GET  /status → ai_tracking_active, storage_free_space_gb, is_recording_*
 */
import { panoptesConfig } from '../lib/panoptesConfig'

export interface BaseStatus {
  aiTracking: boolean
  recording: boolean
  storageGb?: number
  raw: Record<string, unknown>
}

export async function fetchBaseStatus(): Promise<BaseStatus | null> {
  try {
    const res = await fetch(`${panoptesConfig.baseHost}/status`, {
      method: 'GET',
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    return {
      aiTracking: Boolean(data.ai_tracking_active),
      recording: Boolean(data.is_recording_2k || data.is_recording_thermal),
      storageGb:
        typeof data.storage_free_space_gb === 'number'
          ? data.storage_free_space_gb
          : undefined,
      raw: data,
    }
  } catch {
    return null
  }
}

export async function setBaseTracking(on: boolean): Promise<boolean> {
  const path = on ? '/track/auto' : '/track/stop'
  try {
    const res = await fetch(`${panoptesConfig.baseHost}${path}`, { method: 'POST' })
    return res.ok
  } catch {
    return false
  }
}
