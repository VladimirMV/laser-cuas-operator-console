import { useRef, useCallback } from 'react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

/** Circular turret orientation + virtual joystick (mouse/touch) */
export function TurretCompass() {
  const { turret, target, platform, slewTurret, mode } = useHmiStore()
  const { t } = useT()
  const padRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const size = 132
  const cx = size / 2
  const cy = size / 2
  const r = 52

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const needleX = cx + r * Math.cos(toRad(turret.az))
  const needleY = cy + r * Math.sin(toRad(turret.az))
  const tgtX = target ? cx + (r - 8) * Math.cos(toRad(target.azimuth)) : null
  const tgtY = target ? cy + (r - 8) * Math.sin(toRad(target.azimuth)) : null
  const northX = cx + (r + 10) * Math.cos(toRad(0 - platform.heading))
  const northY = cy + (r + 10) * Math.sin(toRad(0 - platform.heading))

  const onPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = (clientX - rect.left) / rect.width - 0.5
      const y = (clientY - rect.top) / rect.height - 0.5
      const mag = Math.hypot(x, y)
      if (mag < 0.08) return
      const scale = Math.min(1, mag * 2) * 1.2
      slewTurret(x * scale * 2.5, -y * scale * 1.5)
    },
    [slewTurret]
  )

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 select-none">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-1 px-0.5">
        {t('turret')} · {mode === 'AUTO' ? t('autoLock') : t('manualSlew')}
      </div>
      <div className="flex gap-2 items-center">
        {/* Compass ring */}
        <svg width={size} height={size} className="shrink-0">
          <circle cx={cx} cy={cy} r={r + 6} fill="#0D1117" stroke="#30363D" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#21262D" strokeWidth={1} />
          {/* Tick marks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
            const a = toRad(d)
            const x1 = cx + (r - 4) * Math.cos(a)
            const y1 = cy + (r - 4) * Math.sin(a)
            const x2 = cx + r * Math.cos(a)
            const y2 = cy + r * Math.sin(a)
            return (
              <line
                key={d}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={d % 90 === 0 ? '#8B949E' : '#30363D'}
                strokeWidth={d % 90 === 0 ? 1.5 : 1}
              />
            )
          })}
          {/* North relative to platform heading */}
          <text
            x={northX}
            y={northY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#3FB950"
            fontSize={9}
            fontFamily="monospace"
          >
            N
          </text>
          {/* Target marker */}
          {tgtX != null && tgtY != null && (
            <circle cx={tgtX} cy={tgtY} r={3.5} fill="#D29922" stroke="#0D1117" strokeWidth={1} />
          )}
          {/* Turret needle */}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke="#58A6FF"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={4} fill="#58A6FF" />
          {/* Elevation bar (right of circle, inline as arc text) */}
          <text x={cx} y={size - 6} textAnchor="middle" fill="#8B949E" fontSize={9} fontFamily="monospace">
            El {turret.el.toFixed(1)}°
          </text>
        </svg>

        {/* Virtual joystick */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div
            ref={padRef}
            className={cn(
              'relative h-[72px] rounded border bg-[#0D1117] touch-none',
              mode === 'AUTO'
                ? 'border-[#30363D] opacity-40 cursor-not-allowed'
                : 'border-[#30363D] hover:border-[#58A6FF]/50 cursor-crosshair'
            )}
            onPointerDown={(e) => {
              if (mode === 'AUTO') return
              dragging.current = true
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              onPointer(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
              if (!dragging.current || mode === 'AUTO') return
              onPointer(e.clientX, e.clientY)
            }}
            onPointerUp={() => {
              dragging.current = false
            }}
            onPointerLeave={() => {
              dragging.current = false
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full border border-[#30363D] bg-[#161B22]/80" />
            </div>
            <div className="absolute top-0.5 left-0 right-0 text-center text-[8px] font-mono text-[#8B949E] pointer-events-none">
              {t('joystick')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
            <div className="bg-[#0D1117] rounded px-1.5 py-0.5 border border-[#30363D]">
              <span className="text-[#8B949E]">Az </span>
              <span className="text-[#58A6FF]">{turret.az.toFixed(1)}°</span>
            </div>
            <div className="bg-[#0D1117] rounded px-1.5 py-0.5 border border-[#30363D]">
              <span className="text-[#8B949E]">El </span>
              <span className="text-[#58A6FF]">{turret.el.toFixed(1)}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
