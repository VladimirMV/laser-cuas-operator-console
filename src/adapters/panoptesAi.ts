/**
 * Panoptes-base AI telemetry (Jetson) — index1.html contract.
 * ws://panoptes-base.local/ws/telemetry
 * targets[id] = { cx, cy, w, h, type } in 640×640 crop; active_id
 */
import { panoptesConfig } from '../lib/panoptesConfig'

export const AI_CAM_W = 1920
export const AI_CAM_H = 1080
export const AI_CROP = 640
export const AI_OFF_X = (AI_CAM_W - AI_CROP) / 2
export const AI_OFF_Y = (AI_CAM_H - AI_CROP) / 2

export interface AiBox {
  id: string
  cx: number
  cy: number
  w: number
  h: number
  type: string
  /** percent of 1920×1080 frame */
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
}

export type AiHandler = (boxes: AiBox[], activeId: string | null) => void

function toBox(id: string, t: Record<string, unknown>): AiBox | null {
  const cx = Number(t.cx ?? t.x)
  const cy = Number(t.cy ?? t.y)
  const w = Number(t.w ?? t.width)
  const h = Number(t.h ?? t.height)
  if (![cx, cy, w, h].every(Number.isFinite)) return null
  // Jetson sends 640×640 crop pixels. If a payload is already full-frame, don't offset twice.
  const cropSpace = cx <= AI_CROP + 16 && cy <= AI_CROP + 16
  const absCx = cropSpace ? cx + AI_OFF_X : cx
  const absCy = cropSpace ? cy + AI_OFF_Y : cy
  return {
    id,
    cx,
    cy,
    w,
    h,
    type: String(t.type ?? t.label ?? 'OBJ'),
    leftPct: ((absCx - w / 2) / AI_CAM_W) * 100,
    topPct: ((absCy - h / 2) / AI_CAM_H) * 100,
    widthPct: (w / AI_CAM_W) * 100,
    heightPct: (h / AI_CAM_H) * 100,
  }
}

export class PanoptesAiTelemetry {
  private ws: WebSocket | null = null
  private handlers = new Set<AiHandler>()
  private intentional = false
  private timer: ReturnType<typeof setTimeout> | null = null
  link: 'OFF' | 'CONNECTING' | 'OK' | 'LOST' = 'OFF'

  onUpdate(cb: AiHandler): () => void {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  connect(): void {
    this.intentional = false
    this.link = 'CONNECTING'
    this.open()
  }

  disconnect(): void {
    this.intentional = true
    if (this.timer) clearTimeout(this.timer)
    try {
      this.ws?.close()
    } catch {
      /* */
    }
    this.ws = null
    this.link = 'OFF'
  }

  private open(): void {
    if (this.intentional) return
    const url = `${panoptesConfig.baseWs}/ws/telemetry`
    try {
      const ws = new WebSocket(url)
      this.ws = ws
      ws.onopen = () => {
        this.link = 'OK'
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            targets?: Record<string, Record<string, unknown>>
            active_id?: number | string
          }
          if (data.targets === undefined) return
          const boxes: AiBox[] = []
          for (const id of Object.keys(data.targets)) {
            const b = toBox(id, data.targets[id] || {})
            if (b) boxes.push(b)
          }
          const active =
            data.active_id !== undefined && data.active_id !== null
              ? String(data.active_id)
              : null
          this.handlers.forEach((h) => h(boxes, active))
        } catch {
          /* */
        }
      }
      ws.onclose = () => {
        this.ws = null
        this.link = 'LOST'
        this.handlers.forEach((h) => h([], null))
        if (!this.intentional) {
          this.timer = setTimeout(() => this.open(), 2000)
        }
      }
    } catch {
      this.link = 'LOST'
      this.timer = setTimeout(() => this.open(), 3000)
    }
  }
}

let inst: PanoptesAiTelemetry | null = null
export function getPanoptesAi(): PanoptesAiTelemetry {
  if (!inst) inst = new PanoptesAiTelemetry()
  return inst
}
