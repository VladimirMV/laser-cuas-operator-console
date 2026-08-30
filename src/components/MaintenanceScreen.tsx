import { Wrench, HardDrive, Thermometer, Zap, RefreshCw, Monitor } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { LayoutProfile, LaserWavelength } from '../types/hmi'
import { collectHealthIssues, foldSystemStatus } from '../lib/systemHealth'

export function MaintenanceScreen() {
  const {
    closeMaintenance,
    extras,
    parallax,
    calibrationStatus,
    turretLink,
    platform,
    biteItems,
    laserStatus,
    layoutProfile,
    setLayoutProfile,
    laserTelemetry: lt,
    laserSimmer,
    laserStandby,
    setLaserEnergyJ,
    setLaserRepRateHz,
    setLaserWavelength,
    setLaserAttenuator,
    resetLaserUserCounter,
    refreshLaserTelemetry,
  } = useHmiStore()
  const { t, lang } = useT()

  const canCtrl = laserStatus === 'SAFE'
  const systemStatus = foldSystemStatus(
    collectHealthIssues({
      turretLink,
      platform,
      laserTelemetry: lt,
      calibrationStatus,
      biteFault: biteItems.some((i) => i.status === 'DEGRADED' || i.status === 'FAULT'),
    })
  )

  const rows = [
    { label: t('tempLaser'), value: `${lt.tempHeadC.toFixed(1)} °C`, icon: Thermometer },
    { label: t('tempBoard'), value: `${lt.tempPsuC.toFixed(1)} °C`, icon: Thermometer },
    { label: t('coolantTemp'), value: `${lt.tempCoolantC.toFixed(1)} °C`, icon: Thermometer },
    { label: t('pulseCount'), value: lt.shotUser.toLocaleString(), icon: Zap },
    { label: t('shotLife'), value: lt.shotLife.toLocaleString(), icon: Zap },
    { label: t('lampLife'), value: `${lt.lampLifePct.toFixed(1)}%`, icon: Zap },
    { label: t('calibStatus'), value: calibrationStatus === 'VALID' ? t('valid') : t('check'), icon: RefreshCw },
    { label: t('calFormula').split('·')[0].trim() || 'Parallax', value: `${parallax.a.toFixed(3)} / ${parallax.c.toFixed(0)}`, icon: HardDrive },
    { label: 'R₀', value: `${parallax.r0} m`, icon: HardDrive },
    { label: t('sys'), value: systemStatus, icon: HardDrive },
    { label: t('laser'), value: laserStatus, icon: Zap },
    { label: t('deviceState'), value: lt.deviceState, icon: Zap },
  ]

  const profiles: { id: LayoutProfile; label: string }[] = [
    { id: 'laptop' as const, label: lang === 'ua' ? 'НОУТБУК 16:9' : 'LAPTOP 16:9' },
    { id: 'soc' as const, label: lang === 'ua' ? 'SOC / СТІЛ' : 'SOC / DESK' },
    { id: 'vehicle' as const, label: lang === 'ua' ? 'БОРТ / КШМ' : 'VEHICLE' },
  ]

  const wavelengths: LaserWavelength[] = [1064, 532, 355, 266]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench size={20} className="text-[#D29922]" />
            <div>
              <h2 className="text-base font-semibold">{t('maintTitle')}</h2>
              <p className="text-xs text-[#8B949E] mt-0.5">{t('maintSubtitle')}</p>
            </div>
          </div>
          <button onClick={closeMaintenance} className="text-[#8B949E] hover:text-[#E6EDF3] text-sm font-mono px-2">
            ✕
          </button>
        </div>

        {/* Quantel control (SAFE only) */}
        <div className="px-5 py-3 border-b border-[#30363D] space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-[#8B949E] tracking-wider">
              {lt.model} · {lt.linkOk ? t('linkOk') : t('linkFail')}
            </div>
            <button
              onClick={() => void refreshLaserTelemetry()}
              className="text-[10px] font-mono text-[#58A6FF] hover:underline"
            >
              {t('refreshTel')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="bg-[#0D1117] border border-[#30363D] rounded p-2">
              <div className="text-[#8B949E] mb-1">{t('energySet')} (J)</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.5}
                  max={lt.energySetMaxJ}
                  step={0.1}
                  value={lt.energySetJ}
                  disabled={!canCtrl}
                  onChange={(e) => void setLaserEnergyJ(parseFloat(e.target.value))}
                  className="flex-1 accent-[#58A6FF]"
                />
                <span className="w-12 text-right text-[#E6EDF3]">{lt.energySetJ.toFixed(1)}</span>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded p-2">
              <div className="text-[#8B949E] mb-1">{t('repRate')} (Hz)</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={lt.repRateMaxHz}
                  step={1}
                  value={lt.repRateHz}
                  disabled={!canCtrl}
                  onChange={(e) => void setLaserRepRateHz(parseInt(e.target.value, 10))}
                  className="flex-1 accent-[#58A6FF]"
                />
                <span className="w-10 text-right text-[#E6EDF3]">{lt.repRateHz}</span>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded p-2">
              <div className="text-[#8B949E] mb-1">{t('attenuator')}</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={lt.attenuatorPct}
                  disabled={laserStatus === 'FIRING'}
                  onChange={(e) => void setLaserAttenuator(parseInt(e.target.value, 10))}
                  className="flex-1 accent-[#D29922]"
                />
                <span className="w-10 text-right text-[#E6EDF3]">{lt.attenuatorPct}%</span>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded p-2">
              <div className="text-[#8B949E] mb-1">λ</div>
              <div className="flex gap-1">
                {wavelengths.map((nm) => (
                  <button
                    key={nm}
                    disabled={!canCtrl}
                    onClick={() => void setLaserWavelength(nm)}
                    className={cn(
                      'flex-1 py-1 rounded border text-[10px] font-semibold',
                      lt.wavelengthNm === nm
                        ? 'border-[#3FB950] text-[#3FB950] bg-[#3FB950]/10'
                        : 'border-[#30363D] text-[#8B949E]',
                      !canCtrl && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {nm}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={!canCtrl}
              onClick={() => void laserSimmer()}
              className={cn(
                'px-3 py-1.5 rounded border text-[11px] font-mono',
                canCtrl
                  ? 'border-[#D29922]/50 text-[#D29922] hover:bg-[#D29922]/10'
                  : 'border-[#30363D] text-[#484F58] cursor-not-allowed'
              )}
            >
              SIMMER
            </button>
            <button
              onClick={() => void laserStandby()}
              className="px-3 py-1.5 rounded border border-[#3FB950]/50 text-[#3FB950] text-[11px] font-mono hover:bg-[#3FB950]/10"
            >
              STANDBY
            </button>
            <button
              disabled={!canCtrl}
              onClick={() => void resetLaserUserCounter()}
              className={cn(
                'px-3 py-1.5 rounded border text-[11px] font-mono',
                canCtrl
                  ? 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
                  : 'border-[#30363D] text-[#484F58] cursor-not-allowed'
              )}
            >
              {t('resetUserShots')}
            </button>
          </div>
          {!canCtrl && (
            <p className="text-[10px] font-mono text-[#D29922]">{t('ctrlOnlySafe')}</p>
          )}
        </div>

        <div className="px-5 py-3 space-y-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between py-2 border-b border-[#21262D] text-sm font-mono"
            >
              <div className="flex items-center gap-2 text-[#8B949E]">
                <r.icon size={14} />
                {r.label}
              </div>
              <div className="text-[#E6EDF3] font-semibold">{r.value}</div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#30363D] space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-[#8B949E] font-mono tracking-wider mb-1">
            <Monitor size={12} />
            {t('layoutProfile')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setLayoutProfile(p.id)}
                className={cn(
                  'py-2 rounded border text-[10px] font-mono font-semibold',
                  layoutProfile === p.id
                    ? 'border-[#3FB950] text-[#3FB950] bg-[#3FB950]/10'
                    : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#30363D] flex justify-end">
          <button
            onClick={closeMaintenance}
            className="px-4 py-2 rounded border border-[#30363D] text-sm font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
