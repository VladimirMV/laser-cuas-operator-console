import { useEffect, useState, useCallback } from 'react'
import { useHmiStore } from '../store/useHmiStore'

/** Global keyboard shortcuts for combat HMI. Disabled while typing in inputs. */
export function useHotkeys() {
  const [showHelp, setShowHelp] = useState(false)

  const {
    laserStatus,
    screen,
    target,
    arm,
    confirmArm,
    safe,
    fireStart,
    fireEnd,
    setMode,
    setActiveCamera,
    setZoom,
    zoom,
    openCalibration,
    openBite,
    openMaintenance,
    loseTrack,
    reacquire,
    toggleLang,
    armConfirm,
    setArmConfirm,
    cancelCalibration,
    closeBite,
    closeMaintenance,
    toggleRecording,
    openSessions,
    closeSessions,
    setShowCameraSettings,
    showCameraSettings,
    slewTurret,
  } = useHmiStore()

  const closeOverlays = useCallback(() => {
    if (screen === 'CALIBRATION') cancelCalibration()
    else if (screen === 'BITE') closeBite()
    else if (screen === 'MAINTENANCE') closeMaintenance()
    else if (screen === 'SESSIONS') closeSessions()
    if (showCameraSettings) setShowCameraSettings(false)
    setShowHelp(false)
  }, [screen, cancelCalibration, closeBite, closeMaintenance, closeSessions, showCameraSettings, setShowCameraSettings])

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return

      const key = e.key
      const lower = key.toLowerCase()

      if (lower === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }

      if (key === 'Escape') {
        e.preventDefault()
        safe()
        setArmConfirm(false)
        closeOverlays()
        return
      }

      if (screen !== 'COMBAT') return

      if (key === '1') { e.preventDefault(); setMode('MANUAL'); return }
      if (key === '2') { e.preventDefault(); setMode('SEMI'); return }
      if (key === '3') { e.preventDefault(); setMode('AUTO'); return }

      if (lower === 'l' || key === 'F1') { e.preventDefault(); setActiveCamera('LONG'); return }
      if (lower === 'w' || key === 'F2') { e.preventDefault(); setActiveCamera('WIDE'); return }
      if (lower === 'i' || key === 'F3') { e.preventDefault(); setActiveCamera('IR'); return }
      if (key === 'F4') { e.preventDefault(); setActiveCamera('MAP'); return }

      if (lower === 's') { e.preventDefault(); safe(); return }
      if (lower === 'a') {
        e.preventDefault()
        if (armConfirm) confirmArm()
        else arm()
        return
      }
      if (key === ' ' || key === 'Spacebar') {
        e.preventDefault()
        if (laserStatus === 'ARMED') fireStart()
        return
      }

      if (lower === 'c') { e.preventDefault(); openCalibration(); return }
      if (lower === 'b') { e.preventDefault(); openBite(); return }
      if (lower === 'm') { e.preventDefault(); openMaintenance(); return }
      if (lower === 'r') { e.preventDefault(); toggleRecording(); return }
      if (lower === 'v') { e.preventDefault(); openSessions(); return }
      if (lower === 'o') { e.preventDefault(); setShowCameraSettings(true); return }

      // Arrow keys / WASD-style already via LWI; arrows slew turret
      if (key === 'ArrowLeft') { e.preventDefault(); slewTurret(-1.5, 0); return }
      if (key === 'ArrowRight') { e.preventDefault(); slewTurret(1.5, 0); return }
      if (key === 'ArrowUp') { e.preventDefault(); slewTurret(0, 1.0); return }
      if (key === 'ArrowDown') { e.preventDefault(); slewTurret(0, -1.0); return }

      if (lower === 't') {
        e.preventDefault()
        if (target?.trackState === 'TRACKING') loseTrack()
        else reacquire()
        return
      }

      if (lower === 'g') { e.preventDefault(); toggleLang(); return }

      if (key === '+' || key === '=') { e.preventDefault(); setZoom(Math.min(20, zoom + 0.5)); return }
      if (key === '-' || key === '_') { e.preventDefault(); setZoom(Math.max(1, zoom - 0.5)); return }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isTyping(e)) return
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        fireEnd()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [
    laserStatus, screen, target, arm, confirmArm, safe, fireStart, fireEnd,
    setMode, setActiveCamera, setZoom, zoom, openCalibration, openBite,
    openMaintenance, loseTrack, reacquire, toggleLang, armConfirm,
    setArmConfirm, closeOverlays, toggleRecording, openSessions, setShowCameraSettings, slewTurret,
  ])

  return { showHelp, setShowHelp }
}

export const HOTKEY_ROWS = [
  { keys: 'Esc', actionKey: 'hkEsc' },
  { keys: '1 / 2 / 3', actionKey: 'hkModes' },
  { keys: 'L / W / I', actionKey: 'hkCams' },
  { keys: 'F1 / F2 / F3', actionKey: 'hkCams' },
  { keys: 'F4', actionKey: 'hkMap' },
  { keys: 'S', actionKey: 'hkSafe' },
  { keys: 'A', actionKey: 'hkArm' },
  { keys: 'Space', actionKey: 'hkFire' },
  { keys: 'C', actionKey: 'hkCal' },
  { keys: 'B', actionKey: 'hkBite' },
  { keys: 'M', actionKey: 'hkMaint' },
  { keys: 'T', actionKey: 'hkTrack' },
  { keys: 'G', actionKey: 'hkLang' },
  { keys: '+ / -', actionKey: 'hkZoom' },
  { keys: 'H', actionKey: 'hkHelp' },
  { keys: 'R', actionKey: 'hkRec' },
  { keys: 'V', actionKey: 'hkSessions' },
  { keys: 'O', actionKey: 'hkCam' },
  { keys: '←↑→↓', actionKey: 'manualSlew' },
] as const
