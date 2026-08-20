import { useEffect, useState } from 'react'
import { Shield, Crosshair, Settings, Clock, Languages, Circle, MapPin, Thermometer } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import { formatCoord } from '../lib/geo'

export function StatusBar() {
  const {
    systemStatus, laserStatus, calibrationStatus, mode, automation,
    toggleLang, recording, toggleRecording, platform, laserTelemetry,
  } = useHmiStore()
  const { t, lang } = useT()
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setTime(
        n.toLocaleTimeString(lang === 'ua' ? 'uk-UA' : 'en-GB', { hour12: false }) +
          '  ' +
          n.toLocaleDateString(lang === 'ua' ? 'uk-UA' : 'en-GB')
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lang])

  const laserCls = {
    SAFE: 'text-[#3FB950] bg-[#3FB950]/15 border-[#3FB950]/40',
    ARMED: 'text-[#D29922] bg-[#D29922]/15 border-[#D29922]/50',
    FIRING: 'text-[#F85149] bg-[#F85149]/20 border-[#F85149] animate-pulse',
  }[laserStatus]

  const autoCls =
    automation === 'COASTING' || automation === 'SEARCHING'
      ? 'text-[#F85149]'
      : automation === 'WAITING_CONFIRM' || automation === 'SLEWING'
        ? 'text-[#D29922]'
        : automation === 'TRACKING'
          ? 'text-[#3FB950]'
          : 'text-[#8B949E]'

  const lt = laserTelemetry
  const ilkOk =
    lt.interlocks.keySwitch &&
    lt.interlocks.eStop &&
    lt.interlocks.cover &&
    lt.interlocks.coolant &&
    lt.interlocks.door &&
    lt.interlocks.overTemp

  return (
    <div className="h-11 flex items-center justify-between px-3 bg-[#161B22] border-b border-[#30363D] select-none shrink-0 gap-2">
      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className={systemStatus === 'OK' && lt.linkOk ? 'text-[#3FB950]' : 'text-[#F85149]'} />
          <span className="text-[10px] text-[#8B949E]">{t('sys')}</span>
          <span className={cn('text-xs font-semibold', systemStatus === 'OK' && lt.linkOk ? 'text-[#3FB950]' : 'text-[#F85149]')}>
            {!lt.linkOk ? 'LINK' : systemStatus}
          </span>
        </div>

        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-xs font-bold', laserCls)}>
          <Crosshair size={12} />
          {laserStatus}
        </div>

        {/* Quantel compact telemetry */}
        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#8B949E]">
          <span className="text-[#E6EDF3]">{lt.wavelengthNm} nm</span>
          <span>
            {lt.energySetJ.toFixed(1)} J
            {lt.energyMeas_mJ != null ? ` · ${lt.energyMeas_mJ} mJ` : ''}
          </span>
          <span>{lt.repRateHz} Hz</span>
          <span className="flex items-center gap-0.5">
            <Thermometer size={10} />
            {lt.tempHeadC.toFixed(0)}°
          </span>
          <span className={ilkOk ? 'text-[#3FB950]' : 'text-[#F85149] font-semibold'}>
            {ilkOk ? t('ilkOk') : t('ilkFail')}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          <Settings size={12} className={calibrationStatus === 'VALID' ? 'text-[#3FB950]' : 'text-[#D29922]'} />
          <span className={calibrationStatus === 'VALID' ? 'text-[#3FB950]' : 'text-[#D29922]'}>
            {calibrationStatus === 'VALID' ? t('valid') : t('check')}
          </span>
        </div>

        <button
          onClick={toggleRecording}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold',
            recording
              ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/15 animate-pulse'
              : 'border-[#30363D] text-[#8B949E] hover:border-[#F85149]/40'
          )}
          title={recording ? t('stopRec') : t('startRec')}
        >
          <Circle size={8} fill={recording ? '#F85149' : 'transparent'} />
          {t('rec')}
        </button>

        <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-[#8B949E] truncate">
          <MapPin size={11} className="text-[#3FB950] shrink-0" />
          {formatCoord(platform.lat, true)} {formatCoord(platform.lon, false)}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
        >
          <Languages size={12} />
          {lang === 'ua' ? 'UA' : 'EN'}
        </button>
        <div className="px-2 py-0.5 rounded bg-[#1C2128] border border-[#30363D] font-mono text-xs font-semibold tracking-wider">
          {mode}
        </div>
        <div className={cn('hidden md:block font-mono text-[10px] tracking-wider', autoCls)}>
          {automation}
        </div>
        <div className="flex items-center gap-1 text-[#8B949E] text-xs font-mono">
          <Clock size={12} />
          {time}
        </div>
      </div>
    </div>
  )
}
