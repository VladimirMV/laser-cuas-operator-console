import { CHANNEL_PRIMARY } from '../lib/streams'
import { HlsPlayer } from './HlsPlayer'
import type { CameraChannel } from '../types/hmi'

export function PipVideo({ channel }: { channel: CameraChannel }) {
  const url = CHANNEL_PRIMARY[channel]
  const isIr = channel === 'IR'

  return (
    <HlsPlayer
      url={url}
      className="absolute inset-0 w-full h-full object-cover"
      style={
        isIr
          ? { filter: 'grayscale(0.4) sepia(0.5) hue-rotate(-15deg) contrast(1.15)' }
          : undefined
      }
    />
  )
}
