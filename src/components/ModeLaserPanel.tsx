import { Shield, Crosshair, Zap } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

export function ModeLaserPanel() {
  const {
    mode, setMode, automation,
    laserStatus, arm, confirmArm, safe, fireStart, fireEnd,
    target, armConfirm, setArmConfirm, aiTracking,
  } = useHmiStore()
  const { t } = useT()

  const canArm =
    laserStatus === 'SAFE' &&
    (target?.trackState === 'TRACKING' ||
      target?.trackState === 'COAST' ||
      mode === 'MANUAL' ||
      aiTracking)
  const canFire = laserStatus === 'ARMED'

  const autoColor =
    automation === 'COASTING' || automation === 'SEARCHING'
      ? 'text-[#F85149]'
      : automation === 'WAITING_CONFIRM' || automation === 'SLEWING'
        ? 'text-[#D29922]'
        : automation === 'TRACKING'
          ? 'text-[#3FB950]'
          : 'text-[#8B949E]'

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2.5 space-y-2.5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[#8B949E] font-mono tracking-wider">{t('mode')}</span>
          <span className={cn('text-[9px] font-mono font-semibold tracking-wider', autoColor)}>
            {automation}
          </span>
        </div>
        <div className="flex gap-1">
          {([
            { id: 'MANUAL' as const, label: t('man') },
            { id: 'SEMI' as const, label: t('semi') },
            { id: 'AUTO' as const, label: t('auto') },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'flex-1 py-1.5 text-[11px] font-mono font-semibold rounded border transition-colors',
                mode === m.id
                  ? 'bg-[#1C2128] border-[#3FB950] text-[#3FB950]'
                  : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'SEMI' && (
          <div className="mt-1 text-[9px] font-mono text-[#8B949E]">
            {t('semiHint')}
          </div>
        )}
        {mode === 'AUTO' && (
          <div className="mt-1 text-[9px] font-mono text-[#D29922]">
            {t('autoHint')}
          </div>
        )}
      </div>

      <div>
        <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-1">{t('laser')}</div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => safe()}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 rounded border text-[10px] font-mono font-semibold transition-all',
              laserStatus === 'SAFE'
                ? 'bg-[#3FB950]/15 border-[#3FB950] text-[#3FB950]'
                : 'border-[#30363D] text-[#8B949E] hover:border-[#3FB950]/50'
            )}
          >
            <Shield size={15} />
            {t('safe')}
          </button>

          {!armConfirm ? (
            <button
              onClick={() => arm()}
              disabled={!canArm}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 rounded border text-[10px] font-mono font-semibold transition-all',
                laserStatus === 'ARMED'
                  ? 'bg-[#D29922]/15 border-[#D29922] text-[#D29922]'
                  : canArm
                    ? 'border-[#30363D] text-[#8B949E] hover:border-[#D29922]/50'
                    : 'border-[#30363D] text-[#30363D] cursor-not-allowed'
              )}
            >
              <Crosshair size={15} />
              {t('ready')}
            </button>
          ) : (
            <button
              onClick={() => confirmArm()}
              className="flex flex-col items-center gap-0.5 py-2 rounded border text-[10px] font-mono font-semibold bg-[#D29922]/20 border-[#D29922] text-[#D29922] animate-pulse"
            >
              <Crosshair size={15} />
              {t('confirm')}
            </button>
          )}

          <button
            onMouseDown={() => fireStart()}
            onMouseUp={() => fireEnd()}
            onMouseLeave={() => fireEnd()}
            onTouchStart={() => fireStart()}
            onTouchEnd={() => fireEnd()}
            disabled={!canFire}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 rounded border text-[10px] font-mono font-semibold transition-all',
              laserStatus === 'FIRING'
                ? 'bg-[#F85149]/20 border-[#F85149] text-[#F85149] animate-pulse'
                : canFire
                  ? 'border-[#30363D] text-[#8B949E] hover:border-[#F85149]/60 hover:text-[#F85149]'
                  : 'border-[#30363D] text-[#30363D] cursor-not-allowed'
            )}
          >
            <Zap size={15} />
            {t('fire')}
          </button>
        </div>
        {armConfirm && (
          <button
            onClick={() => setArmConfirm(false)}
            className="mt-1 w-full text-[10px] font-mono text-[#8B949E] hover:text-[#E6EDF3]"
          >
            {t('cancelArm')}
          </button>
        )}
      </div>
    </div>
  )
}
