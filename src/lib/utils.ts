import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ParallaxCoeffs } from '../types/hmi'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function computeParallaxOffset(
  range: number,
  coeffs: ParallaxCoeffs,
  pxPerMrad = 4.5
) {
  const R = Math.max(range, 50)
  const duMrad = coeffs.a + coeffs.c / R
  const dvMrad = coeffs.d + coeffs.e / R
  return {
    duMrad,
    dvMrad,
    dxPx: duMrad * pxPerMrad,
    dyPx: dvMrad * pxPerMrad,
  }
}

export function fitParallax(measurements: { range: number; du: number; dv: number }[]) {
  const n = measurements.length
  if (n < 2) return null

  let sumX = 0, sumY = 0, sumZ = 0, sumXX = 0, sumXY = 0, sumXZ = 0
  for (const m of measurements) {
    const x = 1 / m.range
    sumX += x
    sumY += m.du
    sumZ += m.dv
    sumXX += x * x
    sumXY += x * m.du
    sumXZ += x * m.dv
  }
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-12) return null

  const c = (n * sumXY - sumX * sumY) / denom
  const a = (sumY - c * sumX) / n
  const e = (n * sumXZ - sumX * sumZ) / denom
  const d = (sumZ - e * sumX) / n

  let sumSq = 0
  for (const m of measurements) {
    const predU = a + c / m.range
    const predV = d + e / m.range
    sumSq += (m.du - predU) ** 2 + (m.dv - predV) ** 2
  }
  const rms = Math.sqrt(sumSq / (2 * n))

  return { a, c, d, e, rms, r0: 2000 }
}
