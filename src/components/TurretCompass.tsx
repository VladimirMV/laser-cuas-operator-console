import { useRef, useCallback, useState } from 'react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import { getPanoptesController } from '../adapters/panoptes'
import { panoptesConfig } from '../lib/panoptesConfig'

/** Scale range for elevation ladder (deg). Match typical PTZ / store limits. */
const EL_MIN = -30
const EL_MAX = 90
const EL_SPAN = EL_MAX - EL_MIN

function elToY(el: number, height: number): number {
  const clamped = Math.max(EL_MIN, Math.min(EL_MAX, el))
  // top = EL_MAX, bottom = EL_MIN
  return ((EL_MAX - clamped) / EL_SPAN) * height
}

/** Vertical elevation ladder (horizon at 0°) */
function ElevationScale({
  el,
  targetEl,
  height = 120,
}: {
  el: number
  targetEl?: number | null
  height?: number
}) {
  const width = 36
  const padY = 4
  const innerH = height - padY * 2
  const ticks = [-30, -15, 0, 15, 30, 45, 60, 75, 90].filter(
    (v) => v >= EL_MIN && v <= EL_MAX
  )
  const markerY = padY + elToY(el, innerH)
  const horizonY = padY + elToY(0, innerH)
  const tgtY =
    targetEl != null && Number.isFinite(targetEl)
      ? padY + elToY(targetEl, innerH)
      : null

  return (
    <svg
      width={width}
      height={height}
      className="shrink-0"
      aria-label={`Elevation ${el.toFixed(1)} degrees`}
    >
      {/* Track */}
      <rect
        x={14}
        y={padY}
        width={4}
        height={innerH}
        rx={1}
        fill="#0D1117"
        stroke="#30363D"
        strokeWidth={1}
      />
      {/* Horizon line (0°) */}
      <line
        x1={8}
        y1={horizonY}
        x2={width - 2}
        y2={horizonY}
        stroke="#3FB950"
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={0.85}
      />
      {/* Ticks + labels */}
      {ticks.map((v) => {
        const y = padY + elToY(v, innerH)
        const major = v === 0 || v % 30 === 0
        return (
          <g key={v}>
            <line
              x1={major ? 10 : 12}
              y1={y}
              x2={18}
              y2={y}
              stroke={v === 0 ? '#3FB950' : '#8B949E'}
              strokeWidth={major ? 1.5 : 1}
            />
            {major && (
              <text
                x={2}
                y={y + 3}
                fill={v === 0 ? '#3FB950' : '#6E7681'}
                fontSize={7}
                fontFamily="ui-monospace, monospace"
              >
                {v}
              </text>
            )}
          </g>
        )
      })}
      {/* Target elevation marker */}
      {tgtY != null && (
        <polygon
          points={`22,${tgtY} 28,${tgtY - 4} 28,${tgtY + 4}`}
          fill="#D29922"
          opacity={0.95}
        />
      )}
      {/* Current elevation marker */}
      <polygon
        points={`20,${markerY} 30,${markerY - 5} 30,${markerY + 5}`}
        fill="#58A6FF"
        stroke="#0D1117"
        strokeWidth={0.5}
      />
      {/* Numeric readout under scale */}
      <text
        x={width / 2}
        y={height - 1}
        textAnchor="middle"
        fill="#58A6FF"
        fontSize={8}
        fontFamily="ui-monospace, monospace"
        fontWeight={700}
      >
        {el >= 0 ? '+' : ''}
        {el.toFixed(1)}°
      </text>
    </svg>
  )
}

/** Circular turret azimuth + vertical elevation scale + joystick + GOTO */
export function TurretCompass() {
  const {
    turret,
    target,
    platform,
    slewTurret,
    mode,
    turretLink,
    turretGoto,
    turretHome,
    turretEStop,
    stopTurretSlew,
  } = useHmiStore()
  const { t } = useT()
  const padRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [panIn, setPanIn] = useState('')
  const [tiltIn, setTiltIn] = useState('')

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

  const stopReal = useCallback(() => {
    stopTurretSlew()
  }, [stopTurretSlew])

  const onPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = (clientX - rect.left) / rect.width - 0.5
      const y = (clientY - rect.top) / rect.height - 0.5
      const mag = Math.hypot(x, y)
      if (mag < 0.08) {
        stopReal()
        return
      }
      const scale = Math.min(1, mag * 2) * 1.2
      slewTurret(x * scale * 2.5, -y * scale * 1.5)
    },
    [slewTurret, stopReal]
  )

  const linkCls =
    turretLink === 'OK'
      ? 'text-[#3FB950]'
      : turretLink === 'CONNECTING'
        ? 'text-[#D29922]'
        : 'text-[#F85149]'

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 select-none">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-1 px-0.5 flex justify-between gap-2">
        <span>
          {t('turret')} · {mode === 'AUTO' ? t('autoLock') : t('manualSlew')}
        </span>
        <span className={cn('font-bold', linkCls)}>
          {turretLink === 'OK'
            ? t('turretLinkOk')
            : turretLink === 'CONNECTING'
              ? t('turretLinkConnecting')
              : t('turretLinkLost')}
        </span>
      </div>

      <div className="flex gap-1.5 items-start">
        {/* Azimuth compass */}
        <svg width={size} height={size} className="shrink-0">
          <circle cx={cx} cy={cy} r={r + 6} fill="#0D1117" stroke="#30363D" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#21262D" strokeWidth={1} />
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
          {tgtX != null && tgtY != null && (
            <circle cx={tgtX} cy={tgtY} r={3.5} fill="#D29922" stroke="#0D1117" strokeWidth={1} />
          )}
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
          <text
            x={cx}
            y={size - 4}
            textAnchor="middle"
            fill="#8B949E"
            fontSize={8}
            fontFamily="monospace"
          >
            Az {turret.az.toFixed(1)}°
          </text>
        </svg>

        {/* Vertical elevation scale */}
        <div className="flex flex-col items-center pt-0.5">
          <div className="text-[8px] font-mono text-[#8B949E] mb-0.5 tracking-wider">EL</div>
          <ElevationScale
            el={turret.el}
            targetEl={target?.elevation ?? null}
            height={size - 4}
          />
        </div>

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
              stopReal()
            }}
            onPointerLeave={() => {
              if (dragging.current) {
                dragging.current = false
                stopReal()
              }
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
              <span className="text-[#58A6FF]">
                {turret.el >= 0 ? '+' : ''}
                {turret.el.toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Positioning (Panoptes) */}
      <div className="mt-2 space-y-1 border-t border-[#21262D] pt-2">
        <div className="flex gap-1">
          <input
            type="number"
            placeholder="Pan"
            value={panIn}
            onChange={(e) => setPanIn(e.target.value)}
            className="flex-1 min-w-0 bg-[#0D1117] border border-[#30363D] rounded px-1.5 py-1 text-[10px] font-mono text-[#E6EDF3]"
          />
          <input
            type="number"
            placeholder="Tilt"
            value={tiltIn}
            onChange={(e) => setTiltIn(e.target.value)}
            className="flex-1 min-w-0 bg-[#0D1117] border border-[#30363D] rounded px-1.5 py-1 text-[10px] font-mono text-[#E6EDF3]"
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => void turretGoto(parseFloat(panIn) || 0, parseFloat(tiltIn) || 0)}
            className="text-[9px] font-mono font-bold py-1 rounded border border-[#58A6FF]/40 text-[#58A6FF] hover:bg-[#58A6FF]/15"
          >
            GOTO
          </button>
          <button
            type="button"
            onClick={() => void turretHome()}
            className="text-[9px] font-mono font-bold py-1 rounded border border-[#D29922]/40 text-[#D29922] hover:bg-[#D29922]/15"
          >
            HOME
          </button>
          <button
            type="button"
            onClick={() => void turretEStop()}
            className="text-[9px] font-mono font-bold py-1 rounded border border-[#F85149]/50 text-[#F85149] hover:bg-[#F85149]/15"
          >
            E-STOP
          </button>
        </div>
      </div>
    </div>
  )
}
