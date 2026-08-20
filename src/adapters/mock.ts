import type { ICueSource, IEffector, EffectorCommand } from './types'
import type { ExternalCue, EffectorId, EffectorStatus } from '../types/hmi'

/** Demo cue source — UI store remains source of truth; this is the port shape */
export class MockRadarCueSource implements ICueSource {
  constructor(private getCues: () => ExternalCue[]) {}
  listCues() {
    return this.getCues()
  }
}

/** Soft-kill stubs: always NOT_FITTED until hardware is integrated */
export class MockEffectorStub implements IEffector {
  constructor(
    public id: EffectorId,
    private status: EffectorStatus = 'NOT_FITTED'
  ) {}
  getStatus() {
    return this.status
  }
  async command(cmd: EffectorCommand) {
    if (this.status === 'NOT_FITTED') {
      return { ok: false, message: `${cmd.effector} NOT FITTED` }
    }
    return { ok: true, message: `${cmd.effector} ${cmd.action}` }
  }
}

export const defaultEffectorStubs: IEffector[] = [
  new MockEffectorStub('JAM'),
  new MockEffectorStub('SPOOF'),
  new MockEffectorStub('DAZZLE'),
]
