import { Map } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import { PipVideo } from './PipVideo'
import type { CameraChannel, MainView } from '../types/hmi'

const CHANNELS: CameraChannel[] = ['LONG', 'WIDE', 'IR']

export function PipWindows() {
  const { activeCamera, setActiveCamera } = useHmiStore()
  const { t } = useT()

  const label = (id: MainView) =>
    id === 'LONG' ? t('long') : id === 'WIDE' ? t('wide') : id === 'IR' ? t('ir') : t('map')

  const mapPips = CHANNELS

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="text-[10px] text-[#8B949E] font-mono tracking-wider px-0.5">
        {t('mainView')}: <span className="text-[#3FB950]">{label(activeCamera)}</span>
      </div>

      {activeCamera !== 'MAP' && (
        <div className="flex gap-1.5">
          {CHANNELS.filter((id) => id !== activeCamera).map((id) => (
            <button
              key={id}
              onClick={() => setActiveCamera(id)}
              className="relative h-[7.25rem] flex-1 rounded border overflow-hidden transition-all border-[#30363D] hover:border-[#3FB950] hover:ring-1 hover:ring-[#3FB950]/30 bg-black"
              title={`${label(id)} → ${t('main')}`}
            >
              <PipVideo channel={id} />
              <div className="absolute bottom-1 left-1.5 text-[10px] font-mono tracking-wider text-white/90 bg-black/60 px-1.5 py-0.5 rounded z-10">
                {label(id)}
              </div>
            </button>
          ))}
        </div>
      )}

      {activeCamera === 'MAP' && (
        <div className="flex gap-1.5">
          {mapPips.map((id) => (
            <button
              key={id}
              onClick={() => setActiveCamera(id)}
              className="relative h-[5.5rem] flex-1 rounded border overflow-hidden transition-all border-[#30363D] hover:border-[#3FB950] bg-black"
            >
              <PipVideo channel={id} />
              <div className="absolute bottom-1 left-1.5 text-[10px] font-mono text-white/90 bg-black/60 px-1.5 py-0.5 rounded z-10">
                {label(id)}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1">
        {([...CHANNELS, 'MAP'] as MainView[]).map((id) => (
          <button
            key={id}
            onClick={() => setActiveCamera(id)}
            className={cn(
              'py-1.5 text-[10px] font-mono font-semibold rounded border transition-colors flex items-center justify-center gap-0.5',
              activeCamera === id
                ? id === 'MAP'
                  ? 'border-[#58A6FF] text-[#58A6FF] bg-[#58A6FF]/10'
                  : 'border-[#3FB950] text-[#3FB950] bg-[#3FB950]/10'
                : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
            )}
          >
            {id === 'MAP' && <Map size={10} />}
            {label(id)}
          </button>
        ))}
      </div>
    </div>
  )
}
