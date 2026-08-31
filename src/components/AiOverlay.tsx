import { useHmiStore } from '../store/useHmiStore'
import { cn } from '../lib/utils'
import { AI_CAM_H, AI_CAM_W, AI_CROP, AI_OFF_X, AI_OFF_Y } from '../adapters/panoptesAi'

export function AiOverlay() {
  const enabled = useHmiStore((s) => s.aiEnabled)
  const boxes = useHmiStore((s) => s.aiTargets)
  const activeId = useHmiStore((s) => s.aiActiveId)
  const selectAiBox = useHmiStore((s) => s.selectAiBox)

  if (!enabled) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[15]">
      <div
        className="absolute border border-dashed border-[#00E5FF]/40 bg-[#00E5FF]/5"
        style={{
          left: `${(AI_OFF_X / AI_CAM_W) * 100}%`,
          top: `${(AI_OFF_Y / AI_CAM_H) * 100}%`,
          width: `${(AI_CROP / AI_CAM_W) * 100}%`,
          height: `${(AI_CROP / AI_CAM_H) * 100}%`,
        }}
      />
      {boxes.map((b) => {
        const active = b.id === activeId
        return (
          <button
            key={b.id}
            type="button"
            className={cn(
              'absolute pointer-events-auto border-2 bg-transparent',
              active
                ? 'border-[#F85149] shadow-[0_0_8px_rgba(248,81,73,0.45)]'
                : 'border-[#3FB950] shadow-[0_0_8px_rgba(63,185,80,0.35)]'
            )}
            style={{
              left: `${b.leftPct}%`,
              top: `${b.topPct}%`,
              width: `${b.widthPct}%`,
              height: `${b.heightPct}%`,
            }}
            title={`${b.type} [${b.id}]`}
            onClick={(e) => {
              e.stopPropagation()
              selectAiBox(b.id)
            }}
          >
            <span
              className={cn(
                'absolute -top-5 left-0 text-[10px] font-mono font-bold px-1 py-0.5 whitespace-nowrap',
                active ? 'bg-[#F85149] text-white' : 'bg-[#3FB950] text-black'
              )}
            >
              {b.type} [{b.id}]
            </span>
          </button>
        )
      })}
    </div>
  )
}
