import { useEffect } from 'react'
import { StatusBar } from './components/StatusBar'
import { MainVideo } from './components/MainVideo'
import { PipWindows } from './components/PipWindows'
import { ModeLaserPanel } from './components/ModeLaserPanel'
import { EffectorLadder } from './components/EffectorLadder'
import { TargetPanel } from './components/TargetPanel'
import { ControlPanel } from './components/ControlPanel'
import { SafetyStrip } from './components/SafetyStrip'
import { CalibrationWizard } from './components/CalibrationWizard'
import { BiteScreen } from './components/BiteScreen'
import { MaintenanceScreen } from './components/MaintenanceScreen'
import { HotkeyHelp } from './components/HotkeyHelp'
import { TurretCompass } from './components/TurretCompass'
import { ExternalCues } from './components/ExternalCues'
import { CameraSettings } from './components/CameraSettings'
import { SessionArchive } from './components/SessionArchive'
import { SituationMap } from './components/SituationMap'
import { Toast } from './components/Toast'
import { useHmiStore } from './store/useHmiStore'
import { useHotkeys } from './hooks/useHotkeys'
import { useT } from './i18n/useT'
import { cn } from './lib/utils'

export default function App() {
  const {
    screen, target, tickCoast, tickCues,
    showCameraSettings, setShowCameraSettings,
    layoutProfile,
    refreshLaserTelemetry,
  } = useHmiStore()
  const { showHelp, setShowHelp } = useHotkeys()
  const { t } = useT()

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

  // Slightly wider right column for camera+MAP strip
  const colW =
    layoutProfile === 'vehicle' ? 'w-72' : layoutProfile === 'laptop' ? 'w-56' : 'w-64'
  const gap = 'gap-2'
  const pad = layoutProfile === 'vehicle' ? 'p-2' : 'p-3'

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0D1117] text-[#E6EDF3] overflow-hidden">
      <StatusBar />

      <div className={cn('flex-1 flex min-h-0', gap, pad)}>
        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <MainVideo />
        </div>

        {/* cameras → mode/laser → effectors → turret → sit map → cues → target → service */}
        <div className={cn('flex flex-col shrink-0 overflow-y-auto', colW, gap)}>
          <PipWindows />
          <ModeLaserPanel />
          <EffectorLadder />
          <TurretCompass />
          <SituationMap />
          <ExternalCues />
          <TargetPanel />
          <ControlPanel />
        </div>
      </div>

      <SafetyStrip />
      <Toast />

      {screen === 'CALIBRATION' && <CalibrationWizard />}
      {screen === 'BITE' && <BiteScreen />}
      {screen === 'MAINTENANCE' && <MaintenanceScreen />}
      {screen === 'SESSIONS' && <SessionArchive />}
      {showCameraSettings && (
        <CameraSettings onClose={() => setShowCameraSettings(false)} />
      )}
      {showHelp && <HotkeyHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}
