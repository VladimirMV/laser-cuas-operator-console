import { useState } from 'react'
import { Wrench, Activity, Settings2, Archive, SlidersHorizontal } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

export function ServicePinModal() {
  const { submitServicePin, closeServiceUi } = useHmiStore()
  const { t } = useT()
  const [pin, setPin] = useState('')

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4"
      onClick={closeServiceUi}
    >
      <div
        className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-xs shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#30363D] font-mono text-xs tracking-wider text-[#8B949E]">
          {t('servicePin')}
        </div>
        <form
          className="px-4 py-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitServicePin(pin)
          }}
        >
          <p className="text-[11px] text-[#8B949E] font-mono">{t('servicePinHint')}</p>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 font-mono text-sm text-[#E6EDF3] outline-none focus:border-[#58A6FF]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeServiceUi}
              className="px-3 py-1.5 rounded border border-[#30363D] text-xs font-mono text-[#8B949E]"
            >
              {t('close')}
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 rounded border border-[#3FB950]/40 text-xs font-mono text-[#3FB950]"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ServiceMenu() {
  const {
    laserStatus,
    openCalibration,
    openBite,
    openMaintenance,
    openSessions,
    setShowCameraSettings,
    closeServiceUi,
  } = useHmiStore()
  const { t } = useT()
  const canService = laserStatus === 'SAFE'

  const items = [
    { id: 'cal', label: t('calibration'), icon: Wrench, disabled: !canService, run: openCalibration },
    { id: 'bite', label: t('bite'), icon: Activity, disabled: false, run: openBite },
    { id: 'mnt', label: t('maintenance'), icon: Settings2, disabled: !canService, run: openMaintenance },
    { id: 'ses', label: t('sessions'), icon: Archive, disabled: false, run: openSessions },
    { id: 'cam', label: t('camSettings'), icon: SlidersHorizontal, disabled: false, run: () => setShowCameraSettings(true) },
  ]

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4"
      onClick={closeServiceUi}
    >
      <div
        className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#30363D] flex items-center justify-between">
          <span className="font-mono text-xs tracking-wider text-[#8B949E]">{t('service')}</span>
          <button
            type="button"
            onClick={closeServiceUi}
            className="text-[#8B949E] hover:text-[#E6EDF3] font-mono text-sm px-2"
          >
            ✕
          </button>
        </div>
        <div className="p-3 space-y-1.5">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                closeServiceUi()
                it.run()
              }}
              className={cn(
                'w-full flex items-center gap-2 py-2 px-3 rounded border text-[12px] font-mono',
                it.disabled
                  ? 'border-[#30363D] text-[#30363D] cursor-not-allowed'
                  : 'border-[#30363D] text-[#E6EDF3] hover:border-[#8B949E]'
              )}
            >
              <it.icon size={14} />
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
