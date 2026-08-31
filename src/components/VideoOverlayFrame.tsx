import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { mapSensorRect, type CoverMap } from '../lib/sensorScreen'

const OverlayCtx = createContext<CoverMap | null>(null)

export function useOverlayMap(): CoverMap | null {
  return useContext(OverlayCtx)
}

export function VideoOverlayFrame({
  srcW = 1920,
  srcH = 1080,
  zoom = 1,
  children,
}: {
  srcW?: number
  srcH?: number
  zoom?: number
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<CoverMap>({ cw: 0, ch: 0, srcW, srcH, zoom })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => {
      setMap({
        cw: el.clientWidth,
        ch: el.clientHeight,
        srcW,
        srcH,
        zoom: Math.max(1, zoom),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [srcW, srcH, zoom])

  return (
    <OverlayCtx.Provider value={map}>
      <div ref={host} className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {children}
      </div>
    </OverlayCtx.Provider>
  )
}

export function SensorBox({
  sx,
  sy,
  sw,
  sh,
  className,
  style,
  children,
}: {
  sx: number
  sy: number
  sw: number
  sh: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const m = useOverlayMap()
  if (!m || !m.cw) return null
  const r = mapSensorRect(m, sx, sy, sw, sh)
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SensorLabel({
  sx,
  sy,
  text,
  className,
}: {
  sx: number
  sy: number
  text: string
  className?: string
}) {
  const m = useOverlayMap()
  if (!m || !m.cw) return null
  const r = mapSensorRect(m, sx, sy, 1, 1)
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: r.left,
        top: r.top,
        transform: 'translateY(-100%)',
        fontSize: 10,
        lineHeight: '16px',
        padding: '1px 5px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {text}
    </div>
  )
}
