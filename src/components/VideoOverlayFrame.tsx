import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Positions children in the same rectangle as an object-cover 1920×1080 stream,
 * including digital zoom from the optical centre. Sensor % then match pixels.
 */
export function VideoOverlayFrame({
  srcW = 1920,
  srcH = 1080,
  zoom = 1,
  className,
  children,
}: {
  srcW?: number
  srcH?: number
  zoom?: number
  className?: string
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => {
      const W = el.clientWidth
      const H = el.clientHeight
      if (!W || !H) return
      const scale = Math.max(W / srcW, H / srcH)
      const width = srcW * scale
      const height = srcH * scale
      setBox({ left: (W - width) / 2, top: (H - height) / 2, width, height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [srcW, srcH])

  return (
    <div ref={host} className={className ?? 'absolute inset-0 overflow-hidden pointer-events-none z-10'}>
      <div
        className="absolute"
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          transform: `scale(${Math.max(1, zoom)})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
