import { useMemo } from 'react'
import { MapPin, Radar, Crosshair, Navigation } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { formatCoord } from '../lib/geo'
import { cn } from '../lib/utils'

/**
 * Full-screen tactical map on main display.
 * Base layer: Google Maps embed centered on platform GPS.
 * Overlay: radar/C2 cues, target, station marker legend + polar bearings.
 */
export function MainMapView() {
  const { platform, target, cues, turret, slewToCue, lang } = useHmiStore()
  const { t } = useT()

  const hl = lang === 'ua' ? 'uk' : 'en'
  const zoom = 14
  // Google Maps embed (no API key required for basic q= embed)
  const embedUrl = useMemo(() => {
    const q = `${platform.lat},${platform.lon}`
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=${hl}&t=m&output=embed`
  }, [platform.lat, platform.lon, hl])

  const activeCues = cues.filter((c) => c.status !== 'DROPPED')
  const radarCues = activeCues.filter((c) => c.source === 'RADAR' || c.source === 'C2')

  // Polar overlay size
  const polar = 200
  const cx = polar / 2
  const cy = polar / 2
  const maxR = 5000
  const scale = (polar / 2 - 16) / maxR

  const toXY = (azDeg: number, rangeM: number) => {
    const az = (azDeg * Math.PI) / 180
    const r = Math.min(rangeM, maxR) * scale
    return { x: cx + r * Math.sin(az), y: cy - r * Math.cos(az) }
  }

  return (
    <div className="relative flex-1 bg-[#0A0E14] overflow-hidden border border-[#30363D] min-h-0">
      {/* Google Maps */}
      <iframe
        title="Google Maps"
        src={embedUrl}
        className="absolute inset-0 w-full h-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      {/* Dim edge for readability of overlays */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black/50 via-transparent to-black/40" />

      {/* Top badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 flex-wrap pointer-events-none">
        <div className="px-2.5 py-1 rounded bg-black/70 border border-[#30363D] font-mono text-xs tracking-widest text-[#3FB950]">
          {t('map')} · Google Maps
        </div>
        <div className="px-2 py-1 rounded bg-black/70 border border-[#30363D] font-mono text-[10px] text-[#E6EDF3]">
          {formatCoord(platform.lat, true)} {formatCoord(platform.lon, false)}
        </div>
        <div className="px-2 py-1 rounded bg-black/70 border border-[#30363D] font-mono text-[10px] text-[#8B949E]">
          {platform.fix} · {platform.sats} {t('sats')}
        </div>
      </div>

      {/* Station + radar polar overlay (bottom-left) */}
      <div className="absolute bottom-3 left-3 z-20 bg-black/75 border border-[#30363D] rounded p-2 pointer-events-none">
        <div className="text-[9px] font-mono text-[#8B949E] mb-1 tracking-wider">
          {t('radarOverlay')} · N-UP
        </div>
        <svg width={polar} height={polar} className="block">
          {[1000, 2000, 3000, 5000].map((r) => (
            <circle key={r} cx={cx} cy={cy} r={r * scale} fill="none" stroke="#30363D" strokeWidth={1} />
          ))}
          <text x={cx} y={12} textAnchor="middle" fill="#8B949E" fontSize={9} fontFamily="monospace">
            N
          </text>
          {/* turret heading */}
          {(() => {
            const h = toXY(turret.az, maxR * 0.35)
            return (
              <line x1={cx} y1={cy} x2={h.x} y2={h.y} stroke="#3FB950" strokeWidth={2} />
            )
          })()}
          {/* cues */}
          {activeCues.map((c) => {
            const p = toXY(c.azimuth, c.range ?? 2500)
            const col = c.source === 'RADAR' ? '#58A6FF' : c.source === 'C2' ? '#D29922' : '#8B949E'
            return (
              <g key={c.id}>
                <circle cx={p.x} cy={p.y} r={4} fill={col} />
                <text x={p.x + 6} y={p.y + 3} fill={col} fontSize={8} fontFamily="monospace">
                  {c.id}
                </text>
              </g>
            )
          })}
          {/* target */}
          {target?.range != null && (
            (() => {
              const p = toXY(target.azimuth, target.range)
              return (
                <g>
                  <circle cx={p.x} cy={p.y} r={5} fill="#F85149" stroke="#FFA657" strokeWidth={1} />
                  <text x={p.x + 7} y={p.y + 3} fill="#FFA657" fontSize={8} fontFamily="monospace">
                    TGT
                  </text>
                </g>
              )
            })()
          )}
          <circle cx={cx} cy={cy} r={4} fill="#3FB950" stroke="#E6EDF3" strokeWidth={1} />
        </svg>
      </div>

      {/* Radar / cues panel (right) */}
      <div className="absolute top-3 right-3 bottom-3 z-20 w-56 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-black/80 border border-[#30363D] rounded p-2.5 flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#8B949E] tracking-wider mb-2">
            <Radar size={12} className="text-[#58A6FF]" />
            {t('radarTracks')}
          </div>

          {/* Station */}
          <div className="mb-2 pb-2 border-b border-[#21262D]">
            <div className="flex items-center gap-1 text-[10px] text-[#3FB950] font-mono font-semibold">
              <MapPin size={11} />
              {t('station')}
            </div>
            <div className="text-[10px] font-mono text-[#E6EDF3] mt-0.5">
              {formatCoord(platform.lat, true)}
              <br />
              {formatCoord(platform.lon, false)}
            </div>
            <div className="text-[9px] font-mono text-[#8B949E]">
              alt {platform.alt} m · hdg {platform.heading.toFixed(0)}°
            </div>
          </div>

          {/* Target */}
          {target && (
            <div className="mb-2 pb-2 border-b border-[#21262D]">
              <div className="flex items-center gap-1 text-[10px] text-[#F85149] font-mono font-semibold">
                <Crosshair size={11} />
                {t('target')}
              </div>
              <div className="text-[10px] font-mono text-[#E6EDF3] mt-0.5">
                {target.classification}
              </div>
              <div className="text-[9px] font-mono text-[#8B949E]">
                R {(target.range / 1000).toFixed(2)} km · Az {target.azimuth.toFixed(1)}° · El{' '}
                {target.elevation.toFixed(1)}°
              </div>
              {target.lat != null && target.lon != null && (
                <div className="text-[9px] font-mono text-[#FFA657]">
                  {formatCoord(target.lat, true)} {formatCoord(target.lon, false)}
                </div>
              )}
            </div>
          )}

          {/* Radar cues */}
          {radarCues.length === 0 && (
            <div className="text-[10px] font-mono text-[#6E7681] py-2">{t('noRadarTracks')}</div>
          )}
          {radarCues.map((c) => (
            <button
              key={c.id}
              onClick={() => slewToCue(c.id)}
              className={cn(
                'w-full text-left mb-1.5 p-1.5 rounded border transition-colors',
                c.status === 'SLEWING' || c.status === 'ACQUIRED'
                  ? 'border-[#58A6FF]/50 bg-[#58A6FF]/10'
                  : 'border-[#30363D] hover:border-[#58A6FF]/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-semibold text-[#58A6FF]">{c.id}</span>
                <span className="text-[9px] font-mono text-[#8B949E]">{c.source}</span>
              </div>
              <div className="text-[9px] font-mono text-[#E6EDF3]">
                Az {c.azimuth.toFixed(1)}° · El {c.elevation.toFixed(1)}°
                {c.range != null ? ` · ${(c.range / 1000).toFixed(1)} km` : ''}
              </div>
              <div className="text-[9px] font-mono text-[#6E7681]">
                Q{c.quality} · {c.ageSec}s · {c.status}
              </div>
              <div className="text-[9px] font-mono text-[#3FB950] mt-0.5 flex items-center gap-1">
                <Navigation size={9} />
                {t('slewTo')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
