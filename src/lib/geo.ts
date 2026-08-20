/** Approximate destination from lat/lon + range(m) + bearing(deg) on WGS84 sphere */
export function destinationPoint(
  lat: number,
  lon: number,
  rangeM: number,
  bearingDeg: number
): { lat: number; lon: number } {
  const R = 6371000
  const δ = rangeM / R
  const θ = (bearingDeg * Math.PI) / 180
  const φ1 = (lat * Math.PI) / 180
  const λ1 = (lon * Math.PI) / 180
  const sinφ2 =
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(sinφ2)
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    )
  return {
    lat: (φ2 * 180) / Math.PI,
    lon: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  }
}

export function formatCoord(v: number, isLat: boolean): string {
  const hemi = isLat ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W'
  return `${Math.abs(v).toFixed(5)}° ${hemi}`
}
