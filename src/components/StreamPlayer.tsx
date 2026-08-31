/**
 * Unified player: HLS (demo) | JPEG poll from sidecar | MJPEG img | placeholder
 */
import { useEffect, useState } from 'react'
import { HlsPlayer } from './HlsPlayer'
import { isHlsUrl } from '../lib/streams'
import { cn } from '../lib/utils'

type Props = {
  url: string | null
  fallbackUrl?: string | null
  className?: string
  notFittedLabel?: string
  thermalStyle?: boolean
  zoom?: number
}

function sidecarSnapUrl(url: string): string | null {
  const m = url.match(/^(https?:\/\/127\.0\.0\.1:8787\/live\/)(LONG|IR)(\b|\/|\.|$)/i)
  if (!m) return null
  return `${m[1]}${m[2].toUpperCase()}.jpg`
}

/** Poll last JPEG from sidecar — reliable for 2K LONG (Chrome multipart often dies). */
function JpegPoll({
  url,
  className,
  thermalStyle,
  zoom,
  onFail,
}: {
  url: string
  className?: string
  thermalStyle?: boolean
  zoom: number
  onFail: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const z = Math.max(1, zoom || 1)

  useEffect(() => {
    let stop = false
    let obj: string | null = null
    let fails = 0
    const tick = async () => {
      if (stop) return
      try {
        const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const blob = await r.blob()
        if (blob.size < 256) throw new Error('empty')
        const next = URL.createObjectURL(blob)
        if (obj) URL.revokeObjectURL(obj)
        obj = next
        setSrc(next)
        fails = 0
      } catch {
        fails += 1
        if (fails >= 25) onFail()
      }
      if (!stop) window.setTimeout(tick, 90)
    }
    void tick()
    return () => {
      stop = true
      if (obj) URL.revokeObjectURL(obj)
    }
  }, [url, onFail])

  return (
    <div className={cn('absolute inset-0 bg-black', className)}>
      {src ? (
        <img
          src={src}
          alt=""
          className={cn('absolute inset-0 w-full h-full object-cover', thermalStyle && 'contrast-125')}
          style={{ transform: `scale(${z})`, transformOrigin: 'center center' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[#6E7681]">
          WAITING LONG/IR…
        </div>
      )}
    </div>
  )
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
  const snap = src ? sidecarSnapUrl(src) : null

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

  if (snap && !failed) {
    return (
      <JpegPoll
        url={snap}
        className={className}
        thermalStyle={thermalStyle}
        zoom={z}
        onFail={() => {
          if (fallbackUrl && fallbackUrl !== src) setSrc(fallbackUrl)
          else setFailed(true)
        }}
      />
    )
  }

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
          if (fallbackUrl && fallbackUrl !== src) setSrc(fallbackUrl)
          else setFailed(true)
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
