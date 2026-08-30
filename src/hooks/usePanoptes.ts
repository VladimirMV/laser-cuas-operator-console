import { useEffect } from 'react'
import { panoptesConfig } from '../lib/panoptesConfig'
import {
  getPanoptesController,
  getPanoptesTelemetry,
} from '../adapters/panoptes'
import { useHmiStore } from '../store/useHmiStore'

/** Connect real Panoptes turret WS when enabled */
export function usePanoptes() {
  useEffect(() => {
    if (!panoptesConfig.useRealTurret) {
      useHmiStore.getState().setTurretLink('DISCONNECTED')
      return
    }

    const ctl = getPanoptesController((ok) => {
      useHmiStore.getState().setTurretLink(ok ? 'OK' : 'LOST')
    })
    const tel = getPanoptesTelemetry()
    ctl.connect()
    tel.connect()
    const off = tel.onUpdate((sample) => {
      useHmiStore.getState().applyTurretTelemetry(sample)
    })

    useHmiStore.getState().showToast(
      useHmiStore.getState().lang === 'ua'
        ? 'Режим Panoptes: підключення до турелі…'
        : 'Panoptes mode: connecting turret…',
      'info'
    )

    return () => {
      off()
      ctl.disconnect()
      tel.disconnect()
    }
  }, [])
}
