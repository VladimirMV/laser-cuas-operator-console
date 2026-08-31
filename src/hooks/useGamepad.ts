/**
 * Xbox-compatible Gamepad API → HMI control
 *   A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7 View=8 Menu=9 L3=10 R3=11
 *   D-pad 12–15 · axes 0/1 left stick · 2/3 right stick
 *
 *   Left stick  — turret slew (fast)
 *   Right stick — turret slew (fine)
 *   D-pad       — turret slew
 *   LT          — cycle cameras
 *   RT          — cycle laser panel SAFE → ARM → FIRE
 *   LB          — AI overlay
 *   RB          — capture / drop tracking (any screen)
 *   A           — capture target
 *   B           — SAFE
 */
import { useEffect, useRef } from 'react'
import { useHmiStore } from '../store/useHmiStore'
import type { MainView } from '../types/hmi'

const DEADZONE = 0.14
const SLEW_AZ = 2.2
const SLEW_EL = 1.4
const FINE_SCALE = 0.35

function axis(v: number, dead = DEADZONE): number {
  return Math.abs(v) < dead ? 0 : v
}

function pressed(btn: GamepadButton | undefined): boolean {
  return !!btn && (btn.pressed || btn.value > 0.45)
}

function pickPad(): Gamepad | null {
  const pads = [...(navigator.getGamepads?.() ?? [])].filter((p): p is Gamepad => !!p)
  if (!pads.length) return null
  return pads.find((p) => p.mapping === 'standard')
    || pads.slice().sort((a, b) => b.buttons.length - a.buttons.length)[0]
    || null
}

/** Right bumper: standard index 5, plus common unmapped layouts (R1=5 or 7 digital). */
function rbDown(gp: Gamepad): boolean {
  if (pressed(gp.buttons[5])) return true
  const b7 = gp.buttons[7]
  if (gp.mapping !== 'standard' && b7 && b7.pressed && b7.value >= 0.95) {
    const analogRt = b7.value > 0.05 && b7.value < 0.95
    if (!analogRt) return true
  }
  return false
}

const CAM_ORDER: MainView[] = ['LONG', 'WIDE', 'IR', 'MAP']

function cycleCamera() {
  const store = useHmiStore.getState()
  const i = CAM_ORDER.indexOf(store.activeCamera)
  const next = CAM_ORDER[(i + 1) % CAM_ORDER.length]
  store.setActiveCamera(next)
}

function cycleLaserPanel() {
  const store = useHmiStore.getState()
  if (store.laserStatus === 'FIRING') {
    store.fireEnd('GAMEPAD')
    return
  }
  if (store.laserStatus === 'ARMED') {
    store.fireStart('GAMEPAD')
    return
  }
  if (store.armConfirm) {
    store.confirmArm('GAMEPAD')
    return
  }
  store.arm('GAMEPAD')
}

export function useGamepad() {
  const edge = useRef<Record<string, boolean>>({})
  const wasSlewing = useRef(false)
  const announced = useRef<string>('')

  useEffect(() => {
    let raf = 0
    let running = true

    const edgeOnce = (key: string, down: boolean): boolean => {
      const was = edge.current[key] ?? false
      edge.current[key] = down
      return down && !was
    }

    const tick = () => {
      if (!running) return
      const gp = pickPad()
      const store = useHmiStore.getState()
      const connected = !!gp
      if (store.gamepadConnected !== connected) {
        store.setGamepadConnected(connected)
      }

      if (gp) {
        const tag = `${gp.id}|${gp.mapping}|${gp.buttons.length}`
        if (announced.current !== tag) {
          announced.current = tag
          store.showToast(
            store.lang === 'ua'
              ? `Геймпад: ${gp.id.split('(')[0].trim()} · RB=захват/скид`
              : `Pad: ${gp.id.split('(')[0].trim()} · RB=capture/drop`,
            'info'
          )
        }
      }

      if (!gp) {
        if (wasSlewing.current) {
          wasSlewing.current = false
          store.stopTurretSlew()
        }
        raf = requestAnimationFrame(tick)
        return
      }

      // Buttons work on every screen. Slew only in combat.
      if (edgeOnce('RB', rbDown(gp))) {
        store.toggleTrackAtAim('GAMEPAD')
      }
      if (edgeOnce('A', pressed(gp.buttons[0]))) {
        store.markTargetAtAim('GAMEPAD')
      }
      if (edgeOnce('LB', pressed(gp.buttons[4]))) {
        store.toggleAi()
      }
      if (edgeOnce('B', pressed(gp.buttons[1]))) {
        if (store.laserStatus === 'FIRING') store.fireEnd('GAMEPAD')
        store.safe('GAMEPAD')
      }
      if (edgeOnce('X', pressed(gp.buttons[2]))) {
        cycleCamera()
      }
      if (edgeOnce('Y', pressed(gp.buttons[3]))) {
        if (store.armConfirm) store.confirmArm('GAMEPAD')
        else store.arm('GAMEPAD')
      }
      if (edgeOnce('LT', pressed(gp.buttons[6]))) {
        cycleCamera()
      }
      if (edgeOnce('RT', pressed(gp.buttons[7]) && !rbDown(gp))) {
        cycleLaserPanel()
      }
      if (edgeOnce('L3', pressed(gp.buttons[10]))) store.bumpZoom(-0.2)
      if (edgeOnce('R3', pressed(gp.buttons[11]))) store.bumpZoom(0.2)
      if (edgeOnce('VIEW', pressed(gp.buttons[8]))) {
        if (store.showServicePin || store.showServiceMenu) store.closeServiceUi()
        else if (store.showCameraSettings) store.setShowCameraSettings(false)
        else if (store.showHelp) store.setShowHelp(false)
        else if (store.screen !== 'COMBAT') store.setScreen('COMBAT')
        else store.exitFullscreen()
      }

      if (store.screen !== 'COMBAT') {
        if (wasSlewing.current) {
          wasSlewing.current = false
          store.stopTurretSlew()
        }
        raf = requestAnimationFrame(tick)
        return
      }

      const lx = axis(gp.axes[0] ?? 0)
      const ly = axis(gp.axes[1] ?? 0)
      const rx = axis(gp.axes[2] ?? 0)
      const ry = axis(gp.axes[3] ?? 0)
      const dpadL = pressed(gp.buttons[14])
      const dpadR = pressed(gp.buttons[15])
      const dpadU = pressed(gp.buttons[12])
      const dpadD = pressed(gp.buttons[13])
      const slewing =
        lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 || dpadL || dpadR || dpadU || dpadD

      if (lx !== 0 || ly !== 0) {
        store.slewTurret(lx * SLEW_AZ, -ly * SLEW_EL)
      } else if (rx !== 0 || ry !== 0) {
        store.slewTurret(rx * SLEW_AZ * FINE_SCALE, -ry * SLEW_EL * FINE_SCALE)
      } else if (dpadL) store.slewTurret(-1.2, 0)
      else if (dpadR) store.slewTurret(1.2, 0)
      else if (dpadU) store.slewTurret(0, 1.0)
      else if (dpadD) store.slewTurret(0, -1.0)

      if (!slewing && wasSlewing.current) {
        store.stopTurretSlew()
      }
      wasSlewing.current = slewing

      raf = requestAnimationFrame(tick)
    }

    const onConnect = () => {
      useHmiStore.getState().setGamepadConnected(true)
    }
    const onDisconnect = () => {
      announced.current = ''
      useHmiStore.getState().setGamepadConnected(false)
      useHmiStore.getState().showToast(
        useHmiStore.getState().lang === 'ua' ? 'Геймпад відключено' : 'Gamepad disconnected',
        'warn'
      )
    }

    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)

    if (pickPad()) useHmiStore.getState().setGamepadConnected(true)

    raf = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])
}
