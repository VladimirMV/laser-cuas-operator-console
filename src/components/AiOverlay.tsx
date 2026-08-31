import { useHmiStore } from '../store/useHmiStore'
import { cn } from '../lib/utils'
import { AI_CAM_H, AI_CAM_W, AI_CROP, AI_OFF_X, AI_OFF_Y } from '../adapters/panoptesAi'
import { SensorBox, SensorLabel } from './VideoOverlayFrame'

export function AiOverlay() {
  const enabled = useHmiStore((s) => s.aiEnabled)
  const boxes = useHmiStore((s) => s.aiTargets)
  const activeId = useHmiStore((s) => s.aiActiveId)
  const selectAiBox = useHmiStore((s) => s.selectAiBox)

  if (!enabled) return null

  return (
    <>
      <SensorBox
        sx={AI_OFF_X}
        sy={AI_OFF_Y}
        sw={AI_CROP}
        sh={AI_CROP}
        className="border border-dashed border-[#00E5FF]/40 bg-[#00E5FF]/5"
        style={{ borderWidth: 1 }}
      />
      {boxes.map((b) => {
        const active = b.id === activeId
        const sx = (b.leftPct / 100) * AI_CAM_W
        const sy = (b.topPct / 100) * AI_CAM_H
        const sw = (b.widthPct / 100) * AI_CAM_W
        const sh = (b.heightPct / 100) * AI_CAM_H
        return (
          <div key={b.id}>
            <SensorBox
              sx={sx}
              sy={sy}
              sw={sw}
              sh={sh}
              className={cn(
                'pointer-events-auto cursor-pointer bg-transparent',
                active
                  ? 'border-[#F85149] shadow-[0_0_8px_rgba(248,81,73,0.45)]'
                  : 'border-[#3FB950] shadow-[0_0_8px_rgba(63,185,80,0.35)]'
              )}
              style={{ borderWidth: 2, borderStyle: 'solid' }}
            >
              <button
                type="button"
                className="absolute inset-0 bg-transparent"
                title={`${b.type} [${b.id}]`}
                onClick={(e) => {
                  e.stopPropagation()
                  selectAiBox(b.id)
                }}
              />
            </SensorBox>
            <SensorLabel
              sx={sx}
              sy={sy}
              text={`${b.type} [${b.id}]`}
              className={
                active
                  ? 'bg-[#F85149] text-white font-mono font-bold pointer-events-none'
                  : 'bg-[#3FB950] text-black font-mono font-bold pointer-events-none'
              }
            />
          </div>
        )
      })}
    </>
  )
}
