import { resolveChannelStream } from '../lib/streams'
import { StreamPlayer } from './StreamPlayer'
import type { CameraChannel } from '../types/hmi'

/** PIP preview — same stream source as main (Panoptes MJPEG or demo HLS) */
export function PipVideo({ channel }: { channel: CameraChannel }) {
  const meta = resolveChannelStream(channel)

  return (
    <StreamPlayer
      url={meta.url}
      fallbackUrl={meta.fallback}
      className="absolute inset-0 w-full h-full object-cover"
      notFittedLabel={channel === 'WIDE' ? 'WIDE' : 'NO STREAM'}
      thermalStyle={channel === 'IR'}
    />
  )
}
