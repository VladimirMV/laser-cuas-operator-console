import { useMemo } from 'react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

/** Compact tactical mini-map: platform, target, cues, range rings */
export function SituationMap() {
  const {
    platform, target, cues, turret, mapTrackUp, setMapTrackUp,
    slewToCue, layoutProfile,
  } = useHmiStore()
  const { t } = useT()

  const size = layoutProfile === 'vehicle' ? 140 : layoutProfile === 'laptop' ? 160 : 190
  const maxRangeM = 5000
  const cx = size / 2
  const cy = size / 2
  const scale = (size / 2 - 12) / maxRangeM

  const rot = mapTrackUp ? -turret.az : 0

  const toXY = (azDeg: number, rangeM: number) => {
    // az relative to north; screen y-up → invert
    const az = ((azDeg + rot) * Math.PI) / 180
    const r = Math.min(rangeM, maxRangeM) * scale
    return { x: cx + r * Math.sin(az), y: cy - r * Math.cos(az) }
  }

  const rings = [1000, 2000, 3000, 5000]
  const activeCues = useMemo(
    () => cues.filter((c) => c.status !== 'DROPPED'),
    [cues]
  )

  const tgt = target?.range
    ? toXY(target.azimuth, target.range)
    : null

  const heading = toXY(mapTrackUp ? 0 : turret.az, maxRangeM * 0.22)

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] text-[#8B949E] font-mono tracking-wider">{t('sitMap')}</span>
        <button
          onClick={() => setMapTrackUp(!mapTrackUp)}
          className={cn(
            'text-[9px] font-mono px-1.5 py-0.5 rounded border',
            mapTrackUp
              ? 'border-[#3FB950] text-[#3FB950]'
              : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
          )}
          title={mapTrackUp ? 'Track-up' : 'North-up'}
        >
          {mapTrackUp ? t('trackUp') : t('northUp')}
        </button>
      </div>

      <svg
        width={size}
        height={size}
        className="mx-auto block bg-[#0D1117] rounded border border-[#21262D]"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* range rings */}
        {rings.map((r) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r * scale}
            fill="none"
            stroke="#21262D"
            strokeWidth={1}
          />
        ))}
        {/* cardinal ticks */}
        {[0, 90, 180, 270].map((a) => {
          const p = toXY(a, maxRangeM)
          return (
            <line
              key={a}
              x1={cx}
              y1={cy}
              x2={cx + (p.x - cx) * 0.08}
              y2={cy + (p.y - cy) * 0.08}
              stroke="#30363D"
              strokeWidth={1}
            />
          )
        })}
        {!mapTrackUp && (
          <text x={cx} y={14} textAnchor="middle" fill="#8B949E" fontSize={9} fontFamily="monospace">
            N
          </text>
        )}

        {/* cues */}
        {activeCues.map((c) => {
          if (c.range == null && c.azimuth == null) return null
          const p = toXY(c.azimuth, c.range ?? 2500)
          const col =
            c.status === 'SLEWING' || c.status === 'ACQUIRED'
              ? '#58A6FF'
              : c.status === 'STALE'
                ? '#6E7681'
                : '#D29922'
          return (
            <g
              key={c.id}
              className="cursor-pointer"
              onClick={() => slewToCue(c.id)}
            >
              <title>{`${c.label} · ${c.range ? (c.range / 1000).toFixed(1) + ' km' : '—'} · ${c.ageSec}s`}</title>
              <circle cx={p.x} cy={p.y} r={4} fill={col} stroke="#0D1117" strokeWidth={1} />
              <text x={p.x + 6} y={p.y + 3} fill={col} fontSize={8} fontFamily="monospace">
                {c.id}
              </text>
            </g>
          )
        })}

        {/* target */}
        {tgt && (
          <g>
            <circle cx={tgt.x} cy={tgt.y} r={5} fill="#F85149" stroke="#FFA657" strokeWidth={1.5} />
            <text x={tgt.x + 7} y={tgt.y + 3} fill="#FFA657" fontSize={8} fontFamily="monospace">
              TGT
            </text>
          </g>
        )}

        {/* platform + heading */}
        <circle cx={cx} cy={cy} r={4} fill="#3FB950" stroke="#E6EDF3" strokeWidth={1} />
        <line
          x1={cx}
          y1={cy}
          x2={heading.x}
          y2={heading.y}
          stroke="#3FB950"
          strokeWidth={1.5}
          markerEnd="url(#ah)"
        />
        <defs>
          <marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#3FB950" />
          </marker>
        </defs>
      </svg>

      <div className="text-[9px] font-mono text-[#8B949E] flex justify-between px-0.5">
        <span>
          {platform.fix} · {platform.sats}s
        </span>
        <span>{target ? `${(target.range / 1000).toFixed(2)} km` : t('noTrack')}</span>
      </div>
    </div>
  )
}
