import type { CalibrationStatus, LaserTelemetry, PlatformGps, SystemStatus } from '../types/hmi'
import type { TurretLinkStatus } from './panoptesConfig'

export type HealthIssue = {
  code: 'TURRET' | 'GPS' | 'LASER_LINK' | 'INTERLOCK' | 'CAL' | 'BITE'
  level: 'DEGRADED' | 'FAULT'
  detail: string
}

export function interlocksOk(lt: LaserTelemetry): boolean {
  const i = lt.interlocks
  return !!(i.keySwitch && i.eStop && i.cover && i.coolant && i.door && i.overTemp)
}

export function gpsHealthy(platform: PlatformGps): boolean {
  if (platform.fix === 'NONE') return false
  if (platform.sats < 4) return false
  return Math.abs(platform.lat) > 0.0002 && Math.abs(platform.lon) > 0.0002
}

export function collectHealthIssues(input: {
  turretLink: TurretLinkStatus
  platform: PlatformGps
  laserTelemetry: LaserTelemetry
  calibrationStatus: CalibrationStatus
  biteFault?: boolean
}): HealthIssue[] {
  const issues: HealthIssue[] = []
  const { turretLink, platform, laserTelemetry: lt, calibrationStatus, biteFault } = input

  if (turretLink === 'DISCONNECTED' || turretLink === 'LOST') {
    issues.push({ code: 'TURRET', level: 'DEGRADED', detail: 'turret link lost' })
  } else if (turretLink === 'CONNECTING') {
    issues.push({ code: 'TURRET', level: 'DEGRADED', detail: 'turret connecting' })
  }

  if (!gpsHealthy(platform)) {
    const detail =
      platform.fix === 'NONE' && platform.sats < 1
        ? 'GPS NONE'
        : `GPS ${platform.fix} · ${platform.sats} sat`
    issues.push({ code: 'GPS', level: 'DEGRADED', detail })
  }

  if (!lt.linkOk) {
    issues.push({ code: 'LASER_LINK', level: 'FAULT', detail: 'laser link down' })
  }

  if (!interlocksOk(lt)) {
    issues.push({ code: 'INTERLOCK', level: 'FAULT', detail: 'interlock fail' })
  }

  if (calibrationStatus !== 'VALID') {
    issues.push({ code: 'CAL', level: 'DEGRADED', detail: 'calibration check' })
  }

  if (biteFault) {
    issues.push({ code: 'BITE', level: 'DEGRADED', detail: 'BITE degraded' })
  }

  return issues
}

export function foldSystemStatus(issues: HealthIssue[]): SystemStatus {
  if (issues.some((i) => i.level === 'FAULT')) return 'FAULT'
  if (issues.length > 0) return 'DEGRADED'
  return 'OK'
}
