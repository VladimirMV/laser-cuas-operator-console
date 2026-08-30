import type { CameraChannel } from '../types/hmi'
import { panoptesConfig } from './panoptesConfig'
import {
  getPanoptesStreamFallback,
  getPanoptesStreamUrl,
} from '../adapters/panoptes'

/**
 * Demo HLS streams (public, CORS-open, no tokens).
 * When VITE_USE_REAL_TURRET=true → Panoptes MJPEG via resolveChannelStream.
 */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url)
}

export const CHANNEL_PRIMARY: Record<CameraChannel, string> = {
  LONG: 'https://ireplay.tv/test/hd_blender.m3u8',
  WIDE: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  IR: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
}

export const CHANNEL_STREAMS: Record<CameraChannel, string[]> = {
  LONG: [
    CHANNEL_PRIMARY.LONG,
    'https://ireplay.tv/test/blender.m3u8',
  ],
  WIDE: [
    CHANNEL_PRIMARY.WIDE,
    'https://test-streams.mux.dev/test_001/stream.m3u8',
    'https://playertest.longtailvideo.com/adaptive/wowzaid3/playlist.m3u8',
  ],
  IR: [
    CHANNEL_PRIMARY.IR,
    'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    'https://test-streams.mux.dev/test_001/stream.m3u8',
  ],
}

export const MJPEG_STREAMS = CHANNEL_STREAMS

export const MP4_FALLBACK =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'

export const MP4_FALLBACK_ALT =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

/** Resolve display URL for a channel (real Panoptes or demo HLS) */
export function resolveChannelStream(channel: CameraChannel): {
  url: string | null
  fallback: string | null
  kind: 'mjpeg' | 'hls' | 'none'
  label: string
} {
  if (panoptesConfig.useRealTurret) {
    const url = getPanoptesStreamUrl(channel)
    const fallback = getPanoptesStreamFallback(channel)
    if (!url) {
      return { url: null, fallback: null, kind: 'none', label: 'NOT FITTED' }
    }
    return {
      url,
      fallback,
      kind: 'mjpeg',
      label: channel === 'LONG' ? 'MJPEG · DAY 2K' : 'MJPEG · THERMAL',
    }
  }
  const url = CHANNEL_PRIMARY[channel]
  return {
    url,
    fallback: null,
    kind: 'hls',
    label: `HLS · ${channel}`,
  }
}
