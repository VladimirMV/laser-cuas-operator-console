import { RotateCcw, Wrench, Activity, Settings2, Archive, SlidersHorizontal } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

export function ControlPanel() {
  const {
    laserStatus, loseTrack, reacquire, target,
    openCalibration, openBite, openMaintenance, openSessions, setShowCameraSettings,
  } = useHmiStore()
  const { t } = useT()
  const canService = laserStatus === 'SAFE'

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2.5 space-y-1.5">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-0.5">SERVICE</div>

      <button
        onClick={target?.trackState === 'TRACKING' ? loseTrack : reacquire}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-[#30363D] text-[11px] font-mono text-[#8B949E] hover:border-[#8B949E] transition-colors"
      >
        <RotateCcw size={12} />
        {target?.trackState === 'TRACKING' ? t('simulateTrackLoss') : t('reacquire')}
      </button>

      <button
        onClick={openCalibration}
        disabled={!canService}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-1.5 rounded border text-[11px] font-mono transition-colors',
          canService
            ? 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
            : 'border-[#30363D] text-[#30363D] cursor-not-allowed'
        )}
      >
        <Wrench size={12} />
        {t('calibration')}
      </button>

      <button
        onClick={openBite}
        disabled={!canService}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-1.5 rounded border text-[11px] font-mono transition-colors',
          canService
            ? 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
            : 'border-[#30363D] text-[#30363D] cursor-not-allowed'
        )}
      >
        <Activity size={12} />
        {t('bite')}
      </button>

      <button
        onClick={openMaintenance}
        disabled={!canService}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-1.5 rounded border text-[11px] font-mono transition-colors',
          canService
            ? 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
            : 'border-[#30363D] text-[#30363D] cursor-not-allowed'
        )}
      >
        <Settings2 size={12} />
        {t('maintenance')}
      </button>

      <button
        onClick={openSessions}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-[#30363D] text-[11px] font-mono text-[#8B949E] hover:border-[#8B949E] transition-colors"
      >
        <Archive size={12} />
        {t('sessions')}
      </button>

      <button
        onClick={() => setShowCameraSettings(true)}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-[#30363D] text-[11px] font-mono text-[#8B949E] hover:border-[#8B949E] transition-colors"
      >
        <SlidersHorizontal size={12} />
        {t('camSettings')}
      </button>
    </div>
  )
}
