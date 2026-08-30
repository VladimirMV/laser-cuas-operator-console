import { useEffect, useMemo, useState } from 'react'
import { Shield, Crosshair, Settings2, Maximize2, Minimize2, Clock, Languages, Circle, MapPin, LayoutDashboard } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import { formatCoord } from '../lib/geo'
import { collectHealthIssues, foldSystemStatus, interlocksOk } from '../lib/systemHealth'

export function StatusBar() {
  const {
    laserStatus, calibrationStatus, mode, automation,
    toggleLang, requestService, toggleFullscreen, isFullscreen,
    recording, toggleRecording, recordingChannels, recordingActualCodec, recordingProfile,
    gamepadConnected, turretLink, platform, laserTelemetry,
    toggleHelp,
    biteItems,
    combatChrome, setCombatChrome, ringHot, setRecChannel, sidecarConnected, mediaRoot,
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
  const ilkOk = interlocksOk(lt)

  const issues = useMemo(
    () =>
      collectHealthIssues({
        turretLink,
        platform,
        laserTelemetry: lt,
        calibrationStatus,
        biteFault: biteItems.some((i) => i.status === 'DEGRADED' || i.status === 'FAULT'),
      }),
    [turretLink, platform, lt, calibrationStatus, biteItems]
  )
  const sys = foldSystemStatus(issues)
  const sysTitle = issues.length
    ? issues.map((i) => `${i.code}: ${i.detail}`).join('\n')
    : t('sysOkHint')

  const sysCls =
    sys === 'OK' ? 'text-[#3FB950]' : sys === 'DEGRADED' ? 'text-[#D29922]' : 'text-[#F85149]'

  return (
    <div className="h-11 flex items-center justify-between px-3 bg-[#161B22] border-b border-[#30363D] select-none shrink-0 gap-2">
      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 pr-2.5 mr-0.5 border-r border-[#30363D] shrink-0">
          <div className="grid h-7 w-7 place-items-center rounded-sm border border-[#58A6FF]/45 bg-[#0D1117] shadow-[inset_0_0_8px_rgba(88,166,255,0.12)]">
            <Crosshair size={13} className="text-[#58A6FF]" />
          </div>
          <div className="leading-none select-none">
            <div className="text-[11px] font-bold tracking-[0.16em] text-[#E6EDF3]">{t('brand')}</div>
            <div className="mt-0.5 text-[8px] font-mono tracking-[0.28em] text-[#58A6FF]/75">{t('brandSub')}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" title={sysTitle}>
          <Shield size={14} className={sysCls} />
          <span className="text-[10px] text-[#8B949E]">{t('sys')}</span>
          <span className={cn('text-xs font-semibold', sysCls)}>
            {sys === 'DEGRADED' ? 'DEGR' : sys}
          </span>
          {issues.length > 0 && (
            <span className="hidden xl:inline text-[9px] font-mono text-[#8B949E] truncate max-w-[14rem]">
              {issues.map((i) => i.code).join(' · ')}
            </span>
          )}
        </div>

        <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-xs font-bold', laserCls)}>
          <Crosshair size={12} />
          {laserStatus === 'ARMED' ? t('ready') : laserStatus}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#8B949E]">
          <span className={ilkOk ? 'text-[#3FB950]' : 'text-[#F85149] font-semibold'}>
            {ilkOk ? t('ilkOk') : t('ilkFail')}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          <Settings2 size={12} className={calibrationStatus === 'VALID' ? 'text-[#3FB950]' : 'text-[#D29922]'} />
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
          title={
            recording
              ? `${t('stopRec')} · ${recordingChannels.join('+')} · ${recordingActualCodec.toUpperCase()}`
              : `${t('startRec')} · ${recordingProfile.codec.toUpperCase()} · ${recordingProfile.mode}`
          }
        >
          <Circle size={8} fill={recording ? '#F85149' : 'transparent'} />
          {recording
            ? `REC ${recordingChannels.join('+')}`
            : t('rec')}
        </button>
        {recording && (
          <span
            className={cn(
              'hidden sm:inline px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
              recordingActualCodec === 'h265'
                ? 'border-[#3FB950]/50 text-[#3FB950]'
                : recordingActualCodec === 'h264'
                  ? 'border-[#D29922]/50 text-[#D29922]'
                  : 'border-[#58A6FF]/50 text-[#58A6FF]'
            )}
            title={t('recCodecHint')}
          >
            {recordingActualCodec === 'meta' ? 'META' : recordingActualCodec.toUpperCase()}
          </span>
        )}

        {ringHot && (
          <span
            className="hidden sm:inline px-1.5 py-0.5 rounded border border-[#58A6FF]/40 text-[#58A6FF] text-[9px] font-mono font-bold"
            title={sidecarConnected && mediaRoot ? `${t('recRingHint')} · ${mediaRoot}` : t('recRingHint')}
          >
            {t('ringHot')}
          </span>
        )}

        {(['LONG', 'WIDE', 'IR'] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={recording}
            onClick={() => setRecChannel(c, !recordingProfile.channels[c])}
            className={cn(
              'hidden lg:inline px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
              recording && 'opacity-50 cursor-not-allowed',
              recordingProfile.channels[c]
                ? 'border-[#3FB950] text-[#3FB950]'
                : 'border-[#30363D] text-[#6E7681]'
            )}
            title={recording ? t('recStopToChange') : t('recChannels')}
          >
            {c}
          </button>
        ))}

        <button
          type="button"
          onClick={() => toggleHelp()}
          className={cn(
            'hidden sm:inline px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
            gamepadConnected
              ? 'border-[#3FB950]/50 text-[#3FB950] bg-[#3FB950]/10 hover:border-[#3FB950]'
              : 'border-[#30363D] text-[#6E7681] hover:border-[#8B949E] hover:text-[#E6EDF3]'
          )}
          title={gamepadConnected ? t('padHelpOpen') : t('padHelpOpenOff')}
        >
          {gamepadConnected ? t('padOn') : t('padOff')}
        </button>
        <span
          className={cn(
            'hidden sm:inline px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
            turretLink === 'OK'
              ? 'border-[#3FB950]/50 text-[#3FB950]'
              : turretLink === 'CONNECTING'
                ? 'border-[#D29922]/50 text-[#D29922]'
                : 'border-[#F85149]/50 text-[#F85149]'
          )}
          title={t('turretLinkTitle')}
        >
          {turretLink === 'OK' ? 'TURRET' : turretLink === 'CONNECTING' ? 'TURRET…' : 'TURRET ✕'}
        </span>

        <div
          className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-[#8B949E] truncate"
          title={`GPS ${platform.fix} sats=${platform.sats} link=${turretLink}`}
        >
          <MapPin
            size={11}
            className={
              turretLink !== 'OK' || platform.fix === 'NONE' || platform.sats < 4
                ? 'text-[#F85149] shrink-0'
                : 'text-[#3FB950] shrink-0'
            }
          />
          {turretLink === 'OK' && platform.fix !== 'NONE' && platform.sats >= 4
            ? `${formatCoord(platform.lat, true)} ${formatCoord(platform.lon, false)} · ${platform.sats}s`
            : turretLink === 'OK' && platform.sats >= 1 && platform.sats < 4
              ? `GPS ACQ · ${platform.sats} sat`
              : 'GPS NONE'}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setCombatChrome(combatChrome === 'hud' ? 'stack' : 'hud')}
          title={combatChrome === 'hud' ? t('combatStack') : t('combatHud')}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#30363D] text-[9px] font-mono font-bold text-[#8B949E] hover:border-[#58A6FF] hover:text-[#58A6FF]"
        >
          <LayoutDashboard size={12} />
          {combatChrome === 'hud' ? t('combatHud') : t('combatStack')}
        </button>
        <button
          type="button"
          onClick={requestService}
          title={t('service')}
          className="p-1 rounded border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#8B949E]"
        >
          <Settings2 size={14} />
        </button>
        <button
          onClick={toggleLang}
          title={lang === 'ua' ? 'Switch to English' : 'Перемкнути на українську'}
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E] hover:text-[#E6EDF3]"
        >
          <Languages size={12} />
          {lang === 'ua' ? 'EN' : 'UA'}
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
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          className="p-1 rounded border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#8B949E]"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </div>
  )
}
