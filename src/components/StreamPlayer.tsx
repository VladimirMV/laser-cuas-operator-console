/**
 * Unified player: HLS (demo) | MJPEG img (Panoptes) | placeholder (WIDE not fitted)
 */
import { useEffect, useState } from 'react'
import { HlsPlayer } from './HlsPlayer'
import { isHlsUrl } from '../lib/streams'
import { cn } from '../lib/utils'

type Props = {
  url: string | null
  fallbackUrl?: string | null
  className?: string
  /** Show "not fitted" when url is null */
  notFittedLabel?: string
  thermalStyle?: boolean
  /** Digital zoom applied only to the picture, not to error labels */
  zoom?: number
}

export function StreamPlayer({
  url,
  fallbackUrl,
  className,
  notFittedLabel = 'NOT FITTED',
  thermalStyle,
  zoom = 1,
}: Props) {
  const z = Math.max(1, zoom || 1)
  const mediaZoom = { transform: `scale(${z})`, transformOrigin: 'center center' } as const
  const [src, setSrc] = useState<string | null>(url)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSrc(url)
    setFailed(false)
  }, [url])

  if (!src) {
    return (
      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center bg-[#0A0E14] text-[#6E7681] font-mono',
          className
        )}
      >
        <div className="text-sm tracking-widest">{notFittedLabel}</div>
        <div className="text-[10px] mt-1 opacity-70">NO STREAM</div>
      </div>
    )
  }

  if (isHlsUrl(src)) {
    return (
      <HlsPlayer
        url={src}
        className={cn('absolute inset-0 w-full h-full object-cover', className)}
        style={mediaZoom}
        loop
        onFatalError={() => {
          if (fallbackUrl && fallbackUrl !== src) setSrc(fallbackUrl)
          else setFailed(true)
        }}
      />
    )
  }

  // MJPEG / progressive JPEG (Panoptes day + thermal)
  return (
    <div className={cn('absolute inset-0 bg-black', className)}>
      <img
        src={src}
        alt=""
        className={cn(
          'absolute inset-0 w-full h-full object-cover',
          thermalStyle && 'contrast-125'
        )}
        style={mediaZoom}
        onError={() => {
          if (fallbackUrl && fallbackUrl !== src) {
            setSrc(fallbackUrl)
          } else {
            setFailed(true)
          }
        }}
      />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-[#F85149] bg-black/80">
          STREAM ERROR
        </div>
      )}
    </div>
  )
}
