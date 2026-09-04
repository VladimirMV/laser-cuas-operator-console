/**
 * While REC is on, push aiming/tracking boxes + turret/range to sidecar
 * so they are burned into rec.mp4 together with date/time.
 */
import { useEffect } from 'react'
import { useHmiStore } from '../store/useHmiStore'
import { DEFAULT_SIDECAR_URL } from '../adapters/mediaRecorder'
import { AI_CAM_H, AI_CAM_W, AI_CROP, AI_OFF_X, AI_OFF_Y } from '../adapters/panoptesAi'

function boxesFromStore() {
  const st = useHmiStore.getState()
  const boxes: { x: number; y: number; w: number; h: number; color: string; label: string; dashed?: boolean }[] = []
  if (st.aiEnabled) {
    boxes.push({
      x: AI_OFF_X / AI_CAM_W,
      y: AI_OFF_Y / AI_CAM_H,
      w: AI_CROP / AI_CAM_W,
      h: AI_CROP / AI_CAM_H,
      color: '#00E5FF',
      label: 'AI',
      dashed: true,
    })
    for (const b of st.aiTargets || []) {
      boxes.push({
        x: (b.leftPct || 0) / 100,
        y: (b.topPct || 0) / 100,
        w: (b.widthPct || 0) / 100,
        h: (b.heightPct || 0) / 100,
        color: b.id === st.aiActiveId ? '#F85149' : '#3FB950',
        label: `${b.type || 'TGT'} [${b.id}]`,
      })
    }
  }
  const t = st.target
  if (t && t.trackState !== 'SEARCH' && t.trackState !== 'LOST') {
    const sizePx = Math.max(72, Math.min(220, 280000 / Math.max(t.range || 1, 1)))
    const cx = ((t.posX ?? 50) / 100) * AI_CAM_W
    const cy = ((t.posY ?? 50) / 100) * AI_CAM_H
    boxes.push({
      x: (cx - sizePx / 2) / AI_CAM_W,
      y: (cy - sizePx / 2) / AI_CAM_H,
      w: sizePx / AI_CAM_W,
      h: sizePx / AI_CAM_H,
      color:
        t.trackState === 'COAST' ? '#D29922' : t.trackQuality > 70 ? '#3FB950' : '#D29922',
      label: `${t.trackState} ${t.id || ''}`.trim(),
      dashed: t.trackState === 'COAST',
    })
  }
  if (st.laserStatus !== 'SAFE') {
    boxes.push({
      x: 0.5 - 24 / AI_CAM_W,
      y: 0.5 - 24 / AI_CAM_H,
      w: 48 / AI_CAM_W,
      h: 48 / AI_CAM_H,
      color: st.laserStatus === 'FIRING' ? '#F85149' : '#FF7B72',
      label: 'LASER',
    })
  }
  const range = t?.range ? `${(t.range / 1000).toFixed(2)}km` : 'R—'
  const line = [
    'LONG',
    `AZ ${st.turret.az.toFixed(1)}`,
    `EL ${st.turret.el.toFixed(1)}`,
    range,
    t?.trackState || 'SEARCH',
    st.laserStatus,
    st.aiEnabled ? 'AI' : '',
  ]
    .filter(Boolean)
    .join('  ')
  return { boxes, line, channel: st.activeCamera === 'IR' ? 'IR' : 'LONG' }
}

export function useRecHud() {
  const recording = useHmiStore((s) => s.recording)
  useEffect(() => {
    if (!recording) return
    let dead = false
    const tick = () => {
      if (dead) return
      const hud = boxesFromStore()
      void fetch(`${DEFAULT_SIDECAR_URL}/record/hud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hud),
      }).catch(() => undefined)
    }
    tick()
    const id = setInterval(tick, 400)
    return () => {
      dead = true
      clearInterval(id)
    }
  }, [recording])
}
