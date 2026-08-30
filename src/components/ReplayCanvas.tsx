import { useEffect, useRef } from 'react'
import type { CameraChannel } from '../types/hmi'
import type { ReplayHud } from '../lib/replayHud'

interface Props {
  channel: CameraChannel
  hud: ReplayHud
  t: number
  className?: string
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export function ReplayCanvas({ channel, hud, t, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w < 4 || h < 4) return
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const ir = channel === 'IR'
    const wide = channel === 'WIDE'

    if (ir) {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#04060a')
      g.addColorStop(0.55, '#0b1520')
      g.addColorStop(1, '#1a3a38')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(40, 90, 80, 0.18)'
      ctx.fillRect(0, h * 0.62, w, h * 0.38)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#6a849c')
      g.addColorStop(0.45, '#8ea3b0')
      g.addColorStop(0.7, '#b7a48a')
      g.addColorStop(1, '#3a4036')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,210,140,0.18)'
      ctx.beginPath()
      ctx.arc(w * 0.78, h * 0.22, 48, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2c332c'
      ctx.beginPath()
      ctx.moveTo(0, h * 0.72)
      ctx.lineTo(w * 0.18, h * 0.64)
      ctx.lineTo(w * 0.4, h * 0.7)
      ctx.lineTo(w * 0.62, h * 0.6)
      ctx.lineTo(w, h * 0.62)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.fill()
    }

    const present = hud.track === 'TRACKING' || hud.track === 'COAST'
    if (present && hud.range > 0) {
      const scale = clamp(3200 / hud.range, 0.2, 3.2) * (wide ? 0.45 : 1)
      const x = w * 0.5 + Math.sin(hud.az * 0.4) * 18
      const y = h * 0.42 + Math.cos(hud.az * 0.3) * 10
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-0.18)
      const s = 30 * scale
      ctx.beginPath()
      ctx.moveTo(s * 1.6, 0)
      ctx.lineTo(-s * 0.2, s * 0.55)
      ctx.lineTo(-s * 1.15, 0)
      ctx.lineTo(-s * 0.2, -s * 0.55)
      ctx.closePath()
      if (ir) {
        const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.8)
        glow.addColorStop(0, '#f4fff8')
        glow.addColorStop(0.45, '#7ee0c8')
        glow.addColorStop(1, 'rgba(20,80,70,0)')
        ctx.fillStyle = glow
        ctx.fill()
      } else {
        ctx.fillStyle = hud.laser === 'FIRING' ? '#2a221c' : '#1b1d18'
        ctx.fill()
      }
      ctx.restore()
      const bw = 56 * scale + 28
      const bh = 36 * scale + 22
      ctx.strokeStyle =
        hud.track === 'COAST' ? '#D29922' : hud.quality > 70 ? '#3FB950' : '#F85149'
      ctx.lineWidth = 1.5
      if (hud.track === 'COAST') ctx.setLineDash([5, 4])
      ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh)
      ctx.setLineDash([])
      ctx.font = "10px 'Roboto Mono', monospace"
      ctx.fillStyle = ctx.strokeStyle as string
      ctx.fillText(`${hud.classification}  ${(hud.range / 1000).toFixed(2)} km`, x - bw / 2, y - bh / 2 - 5)
    }

    if (hud.laser === 'FIRING') {
      const bloom = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 90)
      bloom.addColorStop(0, 'rgba(255,80,50,0.55)')
      bloom.addColorStop(1, 'rgba(255,80,50,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(w / 2 - 90, h / 2 - 90, 180, 180)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2 - 28)
    ctx.lineTo(w / 2, h / 2 + 28)
    ctx.moveTo(w / 2 - 28, h / 2)
    ctx.lineTo(w / 2 + 28, h / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 16, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'
    ctx.stroke()
    void t
  }, [channel, hud, t])

  return <canvas ref={ref} className={className ?? 'absolute inset-0 h-full w-full'} />
}
