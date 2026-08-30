import { PipWindows } from './PipWindows'
import { ModeLaserPanel } from './ModeLaserPanel'
import { TurretCompass } from './TurretCompass'
import { AiDetectPanel } from './AiDetectPanel'
import { EffectorLadder } from './EffectorLadder'
import { SituationMap } from './SituationMap'
import { ExternalCues } from './ExternalCues'
import { TargetPanel } from './TargetPanel'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { RightDockTab } from '../types/hmi'

const TABS: { id: RightDockTab; key: 'dockCam' | 'dockWeapon' | 'dockC2' | 'dockSys' }[] = [
  { id: 'CAM', key: 'dockCam' },
  { id: 'WEAPON', key: 'dockWeapon' },
  { id: 'C2', key: 'dockC2' },
  { id: 'SYS', key: 'dockSys' },
]

export function RightDock() {
  const rightDock = useHmiStore((s) => s.rightDock)
  const setRightDock = useHmiStore((s) => s.setRightDock)
  const { t } = useT()

  return (
    <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-4 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRightDock(tab.id)}
            className={cn(
              'py-1.5 rounded border text-[10px] font-mono font-semibold',
              rightDock === tab.id
                ? 'border-[#58A6FF] bg-[#58A6FF]/10 text-[#58A6FF]'
                : 'border-[#30363D] text-[#8B949E] hover:border-[#8B949E]'
            )}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>
      {rightDock === 'CAM' && <PipWindows />}
      {rightDock === 'WEAPON' && (
        <>
          <ModeLaserPanel />
          <TurretCompass />
        </>
      )}
      {rightDock === 'C2' && (
        <>
          <ExternalCues />
          <SituationMap />
          <AiDetectPanel />
        </>
      )}
      {rightDock === 'SYS' && (
        <>
          <TargetPanel />
          <EffectorLadder />
        </>
      )}
    </div>
  )
}

export function StackDock() {
  return (
    <>
      <PipWindows />
      <ModeLaserPanel />
      <TurretCompass />
      <AiDetectPanel />
      <EffectorLadder />
      <SituationMap />
      <ExternalCues />
      <TargetPanel />
    </>
  )
}
