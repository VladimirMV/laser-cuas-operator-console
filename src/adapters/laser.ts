/**
 * Quantel Q-smart 450 / ICE-family laser control port.
 * Mock implements the command surface used by HMI; swap for RS-232/Ethernet driver later.
 *
 * Reference command map (Ultra/ICE450 family):
 *   A  fire internal | E fire external | M simmer | S standby
 *   EJ energy query/set | D frequency | F/UF shot counters | QI/QE QS sync
 */

import type {
  LaserTelemetry,
  LaserDeviceState,
  LaserWavelength,
  LaserInterlocks,
} from '../types/hmi'

export interface ILaserController {
  connect(): Promise<boolean>
  disconnect(): void
  readTelemetry(): Promise<LaserTelemetry>
  simmer(): Promise<{ ok: boolean; message: string }>
  standby(): Promise<{ ok: boolean; message: string }>
  setEnergyJ(joules: number): Promise<{ ok: boolean; message: string }>
  setRepRateHz(hz: number): Promise<{ ok: boolean; message: string }>
  setWavelength(nm: LaserWavelength): Promise<{ ok: boolean; message: string }>
  setAttenuatorPct(pct: number): Promise<{ ok: boolean; message: string }>
  /** Low-level emission path — HMI must only call via SAFE/ARM/FIRE FSM */
  startFireInternal(): Promise<{ ok: boolean; message: string }>
  stopFire(): Promise<{ ok: boolean; message: string }>
  resetUserCounter(): Promise<{ ok: boolean; message: string }>
}

const defaultInterlocks = (): LaserInterlocks => ({
  keySwitch: true,
  eStop: true,
  cover: true,
  coolant: true,
  door: true,
  overTemp: true,
})

export function createDefaultLaserTelemetry(): LaserTelemetry {
  return {
    model: 'Quantel Q-smart 450',
    linkOk: true,
    deviceState: 'STANDBY',
    emission: false,
    wavelengthNm: 1064,
    energySetJ: 6.0,
    energySetMaxJ: 8.5,
    energyMeas_mJ: 420,
    repRateHz: 10,
    repRateMaxHz: 20,
    pulseDurationNs: 6,
    divergenceMrad: 0.45,
    shotUser: 12847,
    shotLife: 1_250_000,
    shotLifeMax: 100_000_000,
    tempHeadC: 42,
    tempPsuC: 38,
    tempCoolantC: 24,
    attenuatorPct: 100,
    syncMode: 'INTERNAL',
    qsArmed: false,
    harmonicOk: true,
    interlocks: defaultInterlocks(),
    lastError: null,
    lampLifePct: 98.7,
  }
}

/** In-memory mock of Quantel control electronics */
export class MockQuantelAdapter implements ILaserController {
  private tel: LaserTelemetry = createDefaultLaserTelemetry()
  private connected = true

  async connect() {
    this.connected = true
    this.tel.linkOk = true
    this.tel.lastError = null
    return true
  }

  disconnect() {
    this.connected = false
    this.tel.linkOk = false
    this.tel.deviceState = 'STANDBY'
    this.tel.emission = false
  }

  async readTelemetry() {
    if (!this.connected) {
      this.tel.linkOk = false
      return { ...this.tel, interlocks: { ...this.tel.interlocks } }
    }
    // mild simulated drift
    this.tel.tempHeadC = Math.round((this.tel.tempHeadC + (Math.random() - 0.45) * 0.3) * 10) / 10
    this.tel.tempPsuC = Math.round((this.tel.tempPsuC + (Math.random() - 0.5) * 0.2) * 10) / 10
    this.tel.interlocks.overTemp = this.tel.tempHeadC < 55
    this.tel.lampLifePct = Math.max(0, 100 - (this.tel.shotLife / this.tel.shotLifeMax) * 100)
    if (this.tel.emission && this.tel.energyMeas_mJ != null) {
      const nom = this.tel.wavelengthNm === 1064 ? 450 : this.tel.wavelengthNm === 532 ? 220 : 130
      const scale = this.tel.energySetJ / this.tel.energySetMaxJ
      this.tel.energyMeas_mJ = Math.round(nom * scale * this.tel.attenuatorPct / 100 * (0.97 + Math.random() * 0.06))
    }
    return { ...this.tel, interlocks: { ...this.tel.interlocks } }
  }

  private allInterlocksOk() {
    const i = this.tel.interlocks
    return i.keySwitch && i.eStop && i.cover && i.coolant && i.door && i.overTemp
  }

  async simmer() {
    if (!this.allInterlocksOk()) {
      this.tel.deviceState = 'FAULT'
      this.tel.lastError = 'INTERLOCK'
      return { ok: false, message: 'INTERLOCK' }
    }
    this.tel.deviceState = 'SIMMER'
    this.tel.emission = false
    this.tel.qsArmed = false
    return { ok: true, message: 'simmer' }
  }

  async standby() {
    this.tel.deviceState = 'STANDBY'
    this.tel.emission = false
    this.tel.qsArmed = false
    return { ok: true, message: 'standby' }
  }

  async setEnergyJ(joules: number) {
    if (this.tel.emission) return { ok: false, message: 'BUSY_EMISSION' }
    const j = Math.max(0.5, Math.min(this.tel.energySetMaxJ, joules))
    this.tel.energySetJ = Math.round(j * 100) / 100
    return { ok: true, message: `energy ${this.tel.energySetJ.toFixed(2)} J` }
  }

  async setRepRateHz(hz: number) {
    if (this.tel.emission) return { ok: false, message: 'BUSY_EMISSION' }
    const f = Math.max(1, Math.min(this.tel.repRateMaxHz, Math.round(hz)))
    this.tel.repRateHz = f
    return { ok: true, message: `freq ${f}.00Hz` }
  }

  async setWavelength(nm: LaserWavelength) {
    if (this.tel.emission) return { ok: false, message: 'BUSY_EMISSION' }
    this.tel.wavelengthNm = nm
    this.tel.harmonicOk = true
    return { ok: true, message: `λ ${nm} nm` }
  }

  async setAttenuatorPct(pct: number) {
    this.tel.attenuatorPct = Math.max(1, Math.min(100, Math.round(pct)))
    return { ok: true, message: `ATT ${this.tel.attenuatorPct}%` }
  }

  async startFireInternal() {
    if (!this.allInterlocksOk()) {
      this.tel.deviceState = 'FAULT'
      this.tel.lastError = 'INTERLOCK'
      return { ok: false, message: 'INTERLOCK' }
    }
    if (this.tel.deviceState === 'STANDBY') {
      // auto simmer first
      this.tel.deviceState = 'SIMMER'
    }
    this.tel.deviceState = 'FIRE_AUTO'
    this.tel.emission = true
    this.tel.qsArmed = true
    this.tel.shotUser += 1
    this.tel.shotLife += 1
    return { ok: true, message: 'fire auto' }
  }

  async stopFire() {
    this.tel.emission = false
    this.tel.qsArmed = false
    this.tel.deviceState = this.tel.deviceState === 'FAULT' ? 'FAULT' : 'SIMMER'
    return { ok: true, message: 'simmer' }
  }

  async resetUserCounter() {
    if (this.tel.emission) return { ok: false, message: 'BUSY_EMISSION' }
    this.tel.shotUser = 0
    return { ok: true, message: 'cu LP0000000000' }
  }

  /** Test helper: trip interlock */
  tripInterlock(key: keyof LaserInterlocks, ok: boolean) {
    this.tel.interlocks[key] = ok
    if (!ok) {
      this.tel.deviceState = 'FAULT'
      this.tel.emission = false
      this.tel.lastError = `ILK_${key}`
    }
  }
}

export const quantelMock = new MockQuantelAdapter()
