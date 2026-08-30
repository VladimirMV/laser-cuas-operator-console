import { useEffect } from 'react'
import { panoptesConfig } from '../lib/panoptesConfig'
import { getPanoptesAi } from '../adapters/panoptesAi'
import { fetchBaseStatus } from '../adapters/panoptesBase'
import { useHmiStore } from '../store/useHmiStore'

/** Subscribe to base-station AI boxes + poll /status when overlay enabled */
export function usePanoptesAi() {
  const enabled = useHmiStore((s) => s.aiEnabled)

  useEffect(() => {
    if (!enabled || !panoptesConfig.useRealTurret) {
      useHmiStore.getState().setAiLink('OFF')
      return
    }
    const ai = getPanoptesAi()
    ai.connect()
    const off = ai.onUpdate((boxes, activeId) => {
      useHmiStore.getState().applyAiTargets(boxes, activeId, 'OK')
    })
    useHmiStore.getState().setAiLink('CONNECTING')

    let alive = true
    const poll = async () => {
      const st = await fetchBaseStatus()
      if (!alive || !st) return
      useHmiStore.getState().setAiTracking(st.aiTracking)
    }
    void poll()
    const id = setInterval(poll, 3000)

    return () => {
      alive = false
      clearInterval(id)
      off()
      ai.disconnect()
      useHmiStore.getState().applyAiTargets([], null, 'OFF')
    }
  }, [enabled])
}
