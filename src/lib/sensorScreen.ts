/** Map 1920×1080 sensor pixels onto an object-cover + digital-zoom viewport. */

export type CoverMap = {
  cw: number
  ch: number
  srcW: number
  srcH: number
  zoom: number
}

export function coverScale(m: CoverMap): number {
  if (!m.cw || !m.ch) return 1
  return Math.max(m.cw / m.srcW, m.ch / m.srcH)
}

export function mapSensor(m: CoverMap, sx: number, sy: number): { x: number; y: number } {
  const z = Math.max(1, m.zoom || 1)
  const cover = coverScale(m)
  const x0 = (m.cw - m.srcW * cover) / 2 + sx * cover
  const y0 = (m.ch - m.srcH * cover) / 2 + sy * cover
  return {
    x: m.cw / 2 + (x0 - m.cw / 2) * z,
    y: m.ch / 2 + (y0 - m.ch / 2) * z,
  }
}

export function mapSensorRect(
  m: CoverMap,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): { left: number; top: number; width: number; height: number } {
  const a = mapSensor(m, sx, sy)
  const b = mapSensor(m, sx + sw, sy + sh)
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y }
}
