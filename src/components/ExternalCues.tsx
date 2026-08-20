import { Radar, Radio, Ear, Eye, Crosshair } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { CueSource } from '../types/hmi'

const ICONS: Record<CueSource, typeof Radar> = {
  RADAR: Radar,
  C2: Radio,
  ACOUSTIC: Ear,
  EO: Eye,
  MANUAL: Crosshair,
}

export function ExternalCues() {
  const { cues, slewToCue, dismissCue } = useHmiStore()
  const { t } = useT()

  const active = cues.filter((c) => c.status !== 'DROPPED')

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-2 space-y-1.5">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider px-0.5">
        {t('cues')} ({active.length})
      </div>
      {active.length === 0 && (
        <div className="text-[11px] text-[#8B949E] font-mono px-1 py-2">{t('noCues')}</div>
      )}
      <div className="max-h-36 overflow-y-auto space-y-1">
        {active.map((c) => {
          const Icon = ICONS[c.source]
          const statusCls =
            c.status === 'ACQUIRED'
              ? 'text-[#3FB950]'
              : c.status === 'SLEWING'
                ? 'text-[#58A6FF] animate-pulse'
                : c.status === 'STALE'
                  ? 'text-[#D29922]'
                  : 'text-[#E6EDF3]'
          return (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-[#21262D] bg-[#0D1117] text-[10px] font-mono"
            >
              <Icon size={12} className="text-[#8B949E] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-1">
                  <span className="truncate text-[#E6EDF3]">{c.label}</span>
                  <span className={statusCls}>{c.status}</span>
                </div>
                <div className="text-[#8B949E]">
                  {c.azimuth.toFixed(1)}° / {c.elevation.toFixed(1)}°
                  {c.range != null ? ` · ${(c.range / 1000).toFixed(1)} km` : ''} · Q{c.quality}
                </div>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => slewToCue(c.id)}
                  className={cn(
                    'px-1.5 py-0.5 rounded border text-[9px]',
                    'border-[#58A6FF]/40 text-[#58A6FF] hover:bg-[#58A6FF]/10'
                  )}
                  title={t('slewTo')}
                >
                  SLEW
                </button>
                <button
                  onClick={() => dismissCue(c.id)}
                  className="px-1.5 py-0.5 rounded border border-[#30363D] text-[#8B949E] hover:border-[#F85149]/50 text-[9px]"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
