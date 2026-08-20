import { Radio, Navigation, Sun, Crosshair } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { EffectorId } from '../types/hmi'

const ICONS: Record<EffectorId, typeof Radio> = {
  JAM: Radio,
  SPOOF: Navigation,
  DAZZLE: Sun,
  LASER: Crosshair,
}

export function EffectorLadder() {
  const { effectors, activateEffector, laserStatus } = useHmiStore()
  const { t } = useT()

  // Order soft → hard
  const order: EffectorId[] = ['JAM', 'SPOOF', 'DAZZLE', 'LASER']

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 space-y-1.5">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider px-0.5">
        {t('effectors')}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {order.map((id) => {
          const eff = effectors.find((e) => e.id === id)!
          const Icon = ICONS[id]
          const isLaser = id === 'LASER'
          const fitted = eff.status !== 'NOT_FITTED'
          const laserLive = isLaser && laserStatus !== 'SAFE'

          return (
            <button
              key={id}
              onClick={() => activateEffector(id)}
              title={
                isLaser
                  ? t('laserChainHint')
                  : fitted
                    ? `${id}: ${eff.status}`
                    : `${id}: NOT FITTED`
              }
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] font-mono font-semibold transition-all',
                isLaser && laserLive
                  ? laserStatus === 'FIRING'
                    ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/15'
                    : 'border-[#D29922] text-[#D29922] bg-[#D29922]/10'
                  : !fitted
                    ? 'border-[#21262D] text-[#484F58] cursor-default'
                    : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
              )}
            >
              <Icon size={13} />
              {eff.label}
              {!isLaser && (
                <span className="text-[8px] opacity-70">
                  {eff.status === 'NOT_FITTED' ? 'N/F' : eff.status.slice(0, 3)}
                </span>
              )}
              {isLaser && (
                <span className="text-[8px] opacity-80">{laserStatus.slice(0, 3)}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
