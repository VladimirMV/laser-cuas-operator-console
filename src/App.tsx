import { useEffect } from 'react'
import { StatusBar } from './components/StatusBar'
import { MainVideo } from './components/MainVideo'
import { SafetyStrip } from './components/SafetyStrip'
import { CalibrationWizard } from './components/CalibrationWizard'
import { BiteScreen } from './components/BiteScreen'
import { MaintenanceScreen } from './components/MaintenanceScreen'
import { HotkeyHelp } from './components/HotkeyHelp'
import { CameraSettings } from './components/CameraSettings'
import { Toast } from './components/Toast'
import { ServicePinModal, ServiceMenu } from './components/ServiceMenu'
import { RightDock, StackDock } from './components/RightDock'
import { ArchiveWorkspace } from './components/ArchiveWorkspace'
import { useHmiStore } from './store/useHmiStore'
import { useHotkeys } from './hooks/useHotkeys'
import { useGamepad } from './hooks/useGamepad'
import { usePanoptes } from './hooks/usePanoptes'
import { usePanoptesAi } from './hooks/usePanoptesAi'
import { resolveMediaRecorder } from './adapters/mediaRecorder'
import { useT } from './i18n/useT'
import { cn } from './lib/utils'

export default function App() {
  const {
    screen, target, tickCoast, tickCues,
    showCameraSettings, setShowCameraSettings,
    showServicePin, showServiceMenu,
    layoutProfile,
    combatChrome,
    rightPanelCollapsed,
    toggleRightPanel,
    showHelp,
    setShowHelp,
    refreshLaserTelemetry,
    ensureArchiveSession,
    archiveTickTelemetry,
    recording,
    tickRecordingSegments,
    laserStatus,
    pollSidecar,
  } = useHmiStore()
  useHotkeys()
  useGamepad()

  useEffect(() => {
    const onFs = () => useHmiStore.getState().setFullscreenFlag(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  usePanoptes()
  usePanoptesAi()
  const { t, lang } = useT()

  useEffect(() => {
    if (target?.trackState !== 'COAST') return
    const id = setInterval(() => tickCoast(), 1000)
    return () => clearInterval(id)
  }, [target?.trackState, tickCoast])

  useEffect(() => {
    const id = setInterval(() => tickCues(), 1000)
    return () => clearInterval(id)
  }, [tickCues])

  useEffect(() => {
    void refreshLaserTelemetry()
    const id = setInterval(() => void refreshLaserTelemetry(), 2000)
    return () => clearInterval(id)
  }, [refreshLaserTelemetry])

  useEffect(() => {
    ensureArchiveSession()
  }, [ensureArchiveSession])

  useEffect(() => {
    void resolveMediaRecorder().then((rec) => {
      const caps = rec.getCaps()
      console.info(
        '[HMI] media recorder:',
        caps.metaOnly ? 'MockMediaRecorder (meta)' : 'HttpMediaRecorder (side-car)',
        caps
      )
      void useHmiStore.getState().pollSidecar()
    })
    const id = setInterval(() => void useHmiStore.getState().pollSidecar(), 4000)
    return () => clearInterval(id)
  }, [pollSidecar])

  const fastTel =
    laserStatus === 'FIRING' ||
    (laserStatus === 'ARMED' && target?.trackState === 'TRACKING')

  useEffect(() => {
    const id = setInterval(() => archiveTickTelemetry(), fastTel ? 100 : 1000)
    return () => clearInterval(id)
  }, [archiveTickTelemetry, fastTel])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => tickRecordingSegments(), 2000)
    return () => clearInterval(id)
  }, [recording, tickRecordingSegments])

  useEffect(() => {
    document.documentElement.lang = lang === 'ua' ? 'uk' : 'en'
  }, [lang])

  const colW =
    combatChrome === 'hud'
      ? 'w-[19rem]'
      : layoutProfile === 'vehicle'
        ? 'w-80'
        : layoutProfile === 'laptop'
          ? 'w-72'
          : 'w-[19rem]'
  const gap = 'gap-2'
  const pad = layoutProfile === 'vehicle' ? 'p-2' : 'p-3'
  const archiveOpen = screen === 'SESSIONS'

  return (
    <div key={lang} className="h-screen w-screen flex flex-col bg-[#0D1117] text-[#E6EDF3] overflow-hidden">
      <StatusBar />

      <div className={cn('flex-1 flex min-h-0', gap, pad)}>
        {archiveOpen ? (
          <ArchiveWorkspace />
        ) : (
          <>
            <div className="flex-1 flex flex-col min-w-0 gap-2">
              <MainVideo />
            </div>

            <button
              type="button"
              onClick={toggleRightPanel}
              title={rightPanelCollapsed ? t('panelExpand') : t('panelCollapse')}
              className={cn(
                'shrink-0 self-stretch flex items-center justify-center group',
                'w-2.5 rounded-sm border-0 bg-[#21262D] hover:bg-[#388BFD]/40',
                'cursor-col-resize'
              )}
            >
              <span className="h-12 w-0.5 rounded-full bg-[#6E7681] group-hover:bg-[#58A6FF]" />
            </button>

            {!rightPanelCollapsed && (
              <div
                className={cn(
                  'flex flex-col shrink-0 min-h-0',
                  colW,
                  gap,
                  combatChrome === 'stack' ? 'overflow-y-auto' : 'overflow-hidden'
                )}
              >
                {combatChrome === 'hud' ? <RightDock /> : <StackDock />}
              </div>
            )}
          </>
        )}
      </div>

      <SafetyStrip />
      <Toast />

      {screen === 'CALIBRATION' && <CalibrationWizard />}
      {screen === 'BITE' && <BiteScreen />}
      {screen === 'MAINTENANCE' && <MaintenanceScreen />}
      {showCameraSettings && (
        <CameraSettings onClose={() => setShowCameraSettings(false)} />
      )}
      {showHelp && <HotkeyHelp onClose={() => setShowHelp(false)} />}
      {showServicePin && <ServicePinModal />}
      {showServiceMenu && <ServiceMenu />}
    </div>
  )
}
