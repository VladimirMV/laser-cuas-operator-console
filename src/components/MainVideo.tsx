import { useHmiStore, CAMERA_ZOOM } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { computeParallaxOffset, cn } from '../lib/utils'
import { resolveChannelStream } from '../lib/streams'
import { MainMapView } from './MainMapView'
import { StreamPlayer } from './StreamPlayer'
import { AiOverlay } from './AiOverlay'
import { Circle, SlidersHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CameraChannel } from '../types/hmi'

const ALL_CAMS: CameraChannel[] = ['LONG', 'WIDE', 'IR']

export function MainVideo() {
  const target = useHmiStore((s) => s.target)
  const laserStatus = useHmiStore((s) => s.laserStatus)
  const activeCamera = useHmiStore((s) => s.activeCamera)
  const parallax = useHmiStore((s) => s.parallax)
  const cameraAdjust = useHmiStore((s) => s.cameraAdjust)
  const setShowCameraSettings = useHmiStore((s) => s.setShowCameraSettings)
  const recording = useHmiStore((s) => s.recording)
  const turret = useHmiStore((s) => s.turret)
  const aiEnabled = useHmiStore((s) => s.aiEnabled)
  const aiLink = useHmiStore((s) => s.aiLink)
  const toggleAi = useHmiStore((s) => s.toggleAi)
  const { t } = useT()

  const isMap = activeCamera === 'MAP'
  const camChannel: CameraChannel = isMap ? 'LONG' : (activeCamera as CameraChannel)

  if (isMap) {
    return <MainMapView />
  }

  const isLost = target?.trackState === 'COAST' || target?.trackState === 'LOST'
  const range = target?.range ?? 0
  const offset = computeParallaxOffset(range || parallax.r0, parallax)
  const adj = cameraAdjust[camChannel]

  const trackColor =
    !target || target.trackState === 'LOST' || target.trackState === 'SEARCH'
      ? '#F85149'
      : target.trackState === 'COAST'
        ? '#D29922'
        : target.trackQuality > 70
          ? '#3FB950'
          : target.trackQuality > 40
            ? '#D29922'
            : '#F85149'

  const camLabel =
    activeCamera === 'LONG'
      ? t('long')
      : activeCamera === 'WIDE'
        ? t('wide')
        : activeCamera === 'IR'
          ? t('ir')
          : t('map')

  const fov =
    activeCamera === 'LONG' ? '1.8°' : activeCamera === 'WIDE' ? '28°' : '12°'

  const filterFor = (ch: CameraChannel) => {
    const a = cameraAdjust[ch]
    if (ch === 'IR') {
      return `brightness(${a.brightness / 100}) contrast(${a.contrast / 100}) grayscale(0.35) sepia(0.45) hue-rotate(-20deg)`
    }
    return `brightness(${a.brightness / 100}) contrast(${a.contrast / 100})`
  }

  const streamMeta = resolveChannelStream(camChannel)

  return (
    <div className="relative flex-1 bg-[#0A0E14] overflow-hidden border border-[#30363D] min-h-0">
      {/* All three players always mounted — switch = CSS only, no restart */}
      <div className="absolute inset-0 bg-black">
        {ALL_CAMS.map((ch) => (
          <div
            key={ch}
            className="absolute inset-0"
            style={{
              display: ch === camChannel ? 'block' : 'none',
              filter: filterFor(ch),
            }}
          >
            <StreamPlayer
              url={resolveChannelStream(ch).url}
              fallbackUrl={resolveChannelStream(ch).fallback}
              notFittedLabel={ch === 'WIDE' ? 'WIDE — NOT FITTED' : 'NO STREAM'}
              thermalStyle={ch === 'IR'}
              zoom={cameraAdjust[ch].zoom}
            />
          </div>
        ))}
      </div>

      {camChannel === 'LONG' && <AiOverlay />}

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 flex-wrap">
        <div className="px-2.5 py-1 rounded bg-black/60 border border-[#30363D] font-mono text-xs tracking-widest text-[#8B949E]">
          {camLabel}
          {CAMERA_ZOOM[camChannel].hasZoom
            ? ` · ${(cameraAdjust[camChannel].zoom ?? 1).toFixed(1)}×`
            : ''}
        </div>
        {recording && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#F85149]/20 border border-[#F85149]/50 text-[#F85149] font-mono text-[10px] font-bold animate-pulse">
            <Circle size={8} fill="#F85149" /> {t('rec')}
          </div>
        )}
        <button
          type="button"
          onClick={toggleAi}
          className={
            aiEnabled
              ? 'px-2 py-1 rounded border border-[#00E5FF] bg-[#00E5FF]/15 text-[#00E5FF] font-mono text-[10px] font-bold'
              : 'px-2 py-1 rounded border border-[#30363D] bg-black/60 text-[#8B949E] font-mono text-[10px] font-bold hover:border-[#00E5FF]/50'
          }
          title={t('aiOverlay')}
        >
          AI{aiEnabled ? (aiLink === 'OK' ? ' · ON' : ' · …') : ''}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowCameraSettings(true)}
        className="absolute top-3 right-3 z-20 p-1.5 rounded border border-[#30363D] bg-black/60 text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#8B949E]"
        title={t('camSettings')}
      >
        <SlidersHorizontal size={14} />
      </button>

      <div className="absolute bottom-3 left-3 z-20 font-mono text-[11px] text-[#E6EDF3] bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded border border-black/60 shadow-[0_2px_8px_rgba(0,0,0,0.7)] space-y-0.5 max-w-[min(90%,22rem)] [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
        <div>
          R {range ? `${(range / 1000).toFixed(2)} km` : '—'} · {t('fov')} {fov} · {t('turret')}{' '}
          {turret.az.toFixed(1)}°/{turret.el.toFixed(1)}°
        </div>
        <div className="text-[9px] text-[#79C0FF] truncate">
          {streamMeta.url ?? '—'}
        </div>
        {target && laserStatus !== 'SAFE' && (
          <div className="text-[#FFA657]">
            Δ {offset.duMrad.toFixed(2)} / {offset.dvMrad.toFixed(2)} mrad
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="relative w-14 h-14">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/70 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/70 -translate-y-1/2" />
          <div className="absolute inset-2 border border-white/35 rounded-full" />
        </div>
      </div>

      <AnimatePresence>
        {target && laserStatus !== 'SAFE' && activeCamera === 'LONG' && (
          <motion.div
            className="absolute pointer-events-none z-20"
            style={{
              left: `calc(50% + ${offset.dxPx}px)`,
              top: `calc(50% + ${offset.dyPx}px)`,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <div
                className={cn(
                  'w-9 h-9 border-2 rotate-45',
                  laserStatus === 'FIRING'
                    ? 'border-[#F85149] shadow-[0_0_14px_#F85149]'
                    : 'border-[#FF7B72] shadow-[0_0_8px_#FF7B7280]'
                )}
              />
              <div
                className={cn(
                  'absolute inset-0 m-auto w-1.5 h-1.5 rounded-full',
                  laserStatus === 'FIRING' ? 'bg-[#F85149]' : 'bg-[#FF7B72]'
                )}
              />
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[#FFA657] tracking-wider whitespace-nowrap">
                {t('laser')}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {target && target.trackState !== 'SEARCH' && target.trackState !== 'LOST' && (() => {
        const box = Math.max(8, Math.min(22, 18000 / Math.max(range, 1)))
        const cx = target.posX ?? 50
        const cy = target.posY ?? 50
        return (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: `${box}%`,
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              borderWidth: 2,
              borderStyle: target.trackState === 'COAST' ? 'dashed' : 'solid',
              borderColor: trackColor,
              opacity: isLost ? 0.55 : 1,
            }}
          />
        )
      })()}

      <AnimatePresence>
        {isLost && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-30 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="px-8 py-4 border-2 border-[#F85149] bg-[#F85149]/15 rounded">
              <div className="text-[#F85149] font-bold text-2xl tracking-[0.2em] font-mono text-center">
                {t('trackLost')}
              </div>
              {target?.trackState === 'COAST' && (
                <div className="text-center text-[#F85149]/85 font-mono text-sm mt-1">
                  {t('coasting')} {target.coastTimer}s
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!target && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-[#8B949E] font-mono text-sm tracking-widest opacity-70 bg-black/40 px-3 py-1 rounded">
            {t('searching')}
          </div>
        </div>
      )}
    </div>
  )
}
