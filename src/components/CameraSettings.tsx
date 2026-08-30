import { useHmiStore, CAMERA_ZOOM } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import type { CameraChannel } from '../types/hmi'

const CHANNELS: CameraChannel[] = ['LONG', 'WIDE', 'IR']

export function CameraSettings({ onClose }: { onClose: () => void }) {
  const { cameraAdjust, setCameraAdjust, resetCameraAdjust, activeCamera } = useHmiStore()
  const { t } = useT()

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-md shadow-2xl">
        <div className="px-4 py-3 border-b border-[#30363D] flex justify-between items-center">
          <h2 className="text-sm font-semibold">{t('camSettings')}</h2>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3] font-mono text-sm px-2">
            ✕
          </button>
        </div>
        <div className="px-4 py-3 space-y-4">
          {CHANNELS.map((ch) => {
            const adj = cameraAdjust[ch]
            const active = activeCamera !== 'MAP' && ch === activeCamera
            return (
              <div
                key={ch}
                className={`rounded border p-3 space-y-2 ${
                  active ? 'border-[#3FB950]/50 bg-[#3FB950]/5' : 'border-[#30363D]'
                }`}
              >
                <div className="flex justify-between text-xs font-mono">
                  <span className={active ? 'text-[#3FB950]' : 'text-[#E6EDF3]'}>
                    {ch} {active ? `(${t('main')})` : ''}
                  </span>
                  <button
                    onClick={() => resetCameraAdjust(ch)}
                    className="text-[#8B949E] hover:text-[#E6EDF3]"
                  >
                    {t('reset')}
                  </button>
                </div>
                <label className="block text-[10px] text-[#8B949E] font-mono">
                  {t('brightness')}: {adj.brightness}%
                  <input
                    type="range"
                    min={40}
                    max={160}
                    value={adj.brightness}
                    onChange={(e) => setCameraAdjust(ch, 'brightness', Number(e.target.value))}
                    className="w-full accent-[#3FB950]"
                  />
                </label>
                <label className="block text-[10px] text-[#8B949E] font-mono">
                  {t('contrast')}: {adj.contrast}%
                  <input
                    type="range"
                    min={40}
                    max={160}
                    value={adj.contrast}
                    onChange={(e) => setCameraAdjust(ch, 'contrast', Number(e.target.value))}
                    className="w-full accent-[#58A6FF]"
                  />
                </label>
                {CAMERA_ZOOM[ch].hasZoom ? (
                  <label className="block text-[10px] text-[#8B949E] font-mono">
                    {t('zoom')}: {(adj.zoom ?? 1).toFixed(1)}×
                    <input
                      type="range"
                      min={CAMERA_ZOOM[ch].min}
                      max={CAMERA_ZOOM[ch].max}
                      step={CAMERA_ZOOM[ch].step}
                      value={adj.zoom ?? 1}
                      onChange={(e) => setCameraAdjust(ch, 'zoom', Number(e.target.value))}
                      className="w-full accent-[#D29922]"
                    />
                  </label>
                ) : (
                  <div className="text-[10px] font-mono text-[#6E7681]">{t('noZoom')}</div>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 border-t border-[#30363D] flex justify-between">
          <button
            onClick={() => resetCameraAdjust()}
            className="px-3 py-1.5 rounded border border-[#30363D] text-xs font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {t('resetAll')}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#3FB950]/40 text-xs font-mono text-[#3FB950]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
