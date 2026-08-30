/**
 * Basemap with field fallback:
 *  1) local sidecar tiles (offline pack)
 *  2) Carto Dark Matter (online, free)
 *  3) OSM embed
 *  4) schematic grid if everything fails
 */
import { useEffect, useMemo, useState } from 'react'

function lon2tile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z
}
function lat2tile(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z
  )
}

const LOCAL_TMPL = 'http://127.0.0.1:8787/map/tiles/{z}/{x}/{y}.png'
const CARTO_TMPL = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'

type Src = 'local' | 'carto' | 'osm' | 'schematic'

type Props = {
  lat: number
  lon: number
  zoom?: number
  className?: string
}

export function OsmBasemap({ lat, lon, zoom = 15, className }: Props) {
  const [src, setSrc] = useState<Src>('carto')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch('http://127.0.0.1:8787/map/status', { signal: AbortSignal.timeout(800) })
        if (!r.ok) throw new Error('no sidecar')
        const j = (await r.json()) as { offline?: boolean; tiles?: number }
        if (!cancel && j.offline && (j.tiles || 0) > 0) {
          setSrc('local')
          return
        }
      } catch {
        /* online carto */
      }
      if (!cancel) setSrc('carto')
    })()
    return () => {
      cancel = true
    }
  }, [])

  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) > 0.0002 &&
    Math.abs(lon) > 0.0002

  const useLat = valid ? lat : 48.45
  const useLon = valid ? lon : 34.98

  const tmpl = src === 'local' ? LOCAL_TMPL : CARTO_TMPL

  const grid = useMemo(() => {
    const z = zoom
    const xf = lon2tile(useLon, z)
    const yf = lat2tile(useLat, z)
    const cx = Math.floor(xf)
    const cy = Math.floor(yf)
    const fx = xf - cx
    const fy = yf - cy
    const half = 2
    const tiles: { x: number; y: number; dx: number; dy: number }[] = []
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        tiles.push({ x: cx + dx, y: cy + dy, dx, dy })
      }
    }
    return { z, tiles, fx, fy, half, tileSize: 256 }
  }, [useLat, useLon, zoom])

  const n = grid.half * 2 + 1
  const canvas = n * grid.tileSize
  const shiftX = (grid.half - grid.fx) * grid.tileSize + grid.tileSize / 2
  const shiftY = (grid.half - grid.fy) * grid.tileSize + grid.tileSize / 2

  if (src === 'osm') {
    const dLat = 0.018
    const dLon = 0.024
    const iframe = `https://www.openstreetmap.org/export/embed.html?bbox=${
      useLon - dLon
    }%2C${useLat - dLat}%2C${useLon + dLon}%2C${useLat + dLat}&layer=mapnik&marker=${useLat}%2C${useLon}`
    return (
      <iframe title="OpenStreetMap" src={iframe} className={className ?? 'absolute inset-0 w-full h-full border-0'} />
    )
  }

  if (src === 'schematic') {
    return (
      <div className={className ?? 'absolute inset-0 bg-[#0D1117]'}>
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage:
            'linear-gradient(#21262D 1px, transparent 1px), linear-gradient(90deg, #21262D 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#3FB950] border-2 border-white" />
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-[#8B949E]">MAP OFFLINE · GRID</div>
      </div>
    )
  }

  return (
    <div className={className ?? 'absolute inset-0 overflow-hidden bg-[#0D1117]'}>
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: canvas,
          height: canvas,
          transform: `translate(${shiftX - canvas / 2}px, ${shiftY - canvas / 2}px)`,
        }}
      >
        {grid.tiles.map((t) => (
          <img
            key={`${src}_${t.x}_${t.y}`}
            alt=""
            width={256}
            height={256}
            className="absolute"
            style={{
              left: (t.dx + grid.half) * 256,
              top: (t.dy + grid.half) * 256,
            }}
            src={tmpl.replace('{z}', String(grid.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))}
            onError={() => {
              setSrc((prev) => (prev === 'local' ? 'carto' : prev === 'carto' ? 'osm' : 'schematic'))
            }}
            draggable={false}
          />
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className="w-3 h-3 rounded-full bg-[#3FB950] border-2 border-white shadow-[0_0_8px_#3FB950]" />
      </div>
      <div className="absolute bottom-1 right-2 text-[8px] font-mono text-[#6E7681] pointer-events-none">
        {src === 'local' ? 'MAP LOCAL · © OSM © CARTO' : '© OSM © CARTO'}
      </div>
    </div>
  )
}
