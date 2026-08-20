import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import { formatCoord } from '../lib/geo'

export function TargetPanel() {
  const { target, platform } = useHmiStore()
  const { t } = useT()

  if (!target) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded p-3 space-y-2">
        <div className="text-[10px] text-[#8B949E] font-mono tracking-wider">{t('target')}</div>
        <div className="text-sm text-[#8B949E]">{t('noTrack')}</div>
        <div className="pt-1 border-t border-[#30363D] text-[10px] font-mono text-[#8B949E] space-y-0.5">
          <div>{t('platformGps')}</div>
          <div className="text-[#E6EDF3]">
            {formatCoord(platform.lat, true)} {formatCoord(platform.lon, false)}
          </div>
          <div>
            Hdg {platform.heading.toFixed(0)}° · {platform.fix} · {platform.sats} sats
          </div>
        </div>
      </div>
    )
  }

  const qColor =
    target.trackQuality > 70 ? 'bg-[#3FB950]' : target.trackQuality > 40 ? 'bg-[#D29922]' : 'bg-[#F85149]'
  const stateLabel =
    target.trackState === 'TRACKING' ? t('locked') : target.trackState === 'COAST' ? t('coast') : target.trackState

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8B949E] font-mono tracking-wider">{t('target')}</span>
        <span
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded',
            target.trackState === 'TRACKING' ? 'bg-[#3FB950]/20 text-[#3FB950]' : 'bg-[#F85149]/20 text-[#F85149]'
          )}
        >
          {stateLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm font-mono">
        <div className="text-[#8B949E] text-xs">{t('range')}</div>
        <div className="text-right text-[#E6EDF3] font-semibold">{(target.range / 1000).toFixed(2)} km</div>
        <div className="text-[#8B949E] text-xs">{t('az')}</div>
        <div className="text-right">{target.azimuth.toFixed(1)}°</div>
        <div className="text-[#8B949E] text-xs">{t('el')}</div>
        <div className="text-right">{target.elevation.toFixed(1)}°</div>
        <div className="text-[#8B949E] text-xs">{t('class')}</div>
        <div className="text-right text-[#D29922] text-xs font-semibold">{target.classification}</div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-[#8B949E] mb-1 font-mono">
          <span>{t('trackQ')}</span>
          <span>{target.trackQuality}%</span>
        </div>
        <div className="h-1.5 bg-[#0D1117] rounded overflow-hidden">
          <div className={cn('h-full transition-all duration-300', qColor)} style={{ width: `${target.trackQuality}%` }} />
        </div>
      </div>

      {/* GPS block */}
      <div className="pt-1.5 border-t border-[#30363D] text-[10px] font-mono space-y-1">
        <div className="text-[#8B949E]">{t('platformGps')}</div>
        <div className="text-[#E6EDF3]">
          {formatCoord(platform.lat, true)} · {formatCoord(platform.lon, false)}
        </div>
        <div className="text-[#8B949E]">
          {platform.alt.toFixed(0)} m · Hdg {platform.heading.toFixed(0)}° · {platform.fix}
        </div>
        {target.lat != null && target.lon != null && (
          <>
            <div className="text-[#8B949E] pt-1">{t('targetGps')}</div>
            <div className="text-[#D29922]">
              {formatCoord(target.lat, true)} · {formatCoord(target.lon, false)}
            </div>
            {target.alt != null && (
              <div className="text-[#8B949E]">Alt ≈ {target.alt.toFixed(0)} m</div>
            )}
          </>
        )}
      </div>

      {target.trackState === 'COAST' && (
        <div className="text-center text-[#F85149] font-mono text-xs font-bold animate-pulse">
          {t('coast')} {target.coastTimer}s
        </div>
      )}
    </div>
  )
}
