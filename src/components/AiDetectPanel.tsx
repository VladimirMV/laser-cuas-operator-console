import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

/** NN detection control — overlay + Jetson /track/auto */
export function AiDetectPanel() {
  const {
    aiEnabled, toggleAi, aiLink, aiTracking,
    aiTargets, aiActiveId, startAiDetect, stopAiDetect, selectAiBox,
  } = useHmiStore()
  const { t } = useT()

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8B949E] font-mono tracking-wider">
          {t('nnDetect')}
        </span>
        <span
          className={cn(
            'text-[9px] font-mono font-bold',
            aiLink === 'OK' ? 'text-[#3FB950]' : aiLink === 'CONNECTING' ? 'text-[#D29922]' : 'text-[#6E7681]'
          )}
        >
          {aiLink === 'OK' ? 'WS OK' : aiLink === 'CONNECTING' ? 'WS…' : 'WS OFF'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={toggleAi}
          className={cn(
            'py-1.5 text-[10px] font-mono font-bold rounded border',
            aiEnabled
              ? 'border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10'
              : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
          )}
        >
          {aiEnabled ? t('nnOverlayOn') : t('nnOverlayOff')}
        </button>
        <button
          type="button"
          onClick={() => void (aiTracking ? stopAiDetect() : startAiDetect())}
          className={cn(
            'py-1.5 text-[10px] font-mono font-bold rounded border',
            aiTracking
              ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/10'
              : 'border-[#3FB950]/50 text-[#3FB950] hover:bg-[#3FB950]/10'
          )}
        >
          {aiTracking ? t('nnTrackStop') : t('nnTrackStart')}
        </button>
      </div>
      <div className="text-[9px] font-mono text-[#8B949E]">
        {t('nnBoxes')}: {aiTargets.length}
        {aiActiveId ? ` · ID ${aiActiveId}` : ''}
      </div>
      {aiTargets.length > 0 && (
        <div className="max-h-16 overflow-y-auto space-y-0.5">
          {aiTargets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => selectAiBox(b.id)}
              className={cn(
                'w-full text-left px-1.5 py-0.5 rounded text-[9px] font-mono border',
                b.id === aiActiveId
                  ? 'border-[#F85149]/60 text-[#F85149]'
                  : 'border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
              )}
            >
              {b.type} [{b.id}]
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
