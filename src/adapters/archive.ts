/**
 * Archive writer/reader contracts + in-memory mock.
 * Production: swap MockArchiveAdapter for IndexedDB / NAS side-car.
 */

import type {
  ArchiveEvent,
  ArchiveEventFilter,
  ArchiveEventSource,
  ArchiveEventType,
  ArchiveSession,
  ConfigSnapshot,
  Engagement,
  EngagementResult,
  MediaRef,
  Mission,
  SessionBundle,
  SessionStartMeta,
  TelemetrySample,
} from '../types/archive'
import type { OperationMode } from '../types/hmi'

const SW_VERSION = '1.8.1'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface IArchiveWriter {
  startSession(meta: SessionStartMeta): string
  appendEvent(
    partial: Omit<ArchiveEvent, 'id' | 'ts_utc' | 't_mono_ms' | 'session_id'> & {
      session_id?: string
      t_mono_ms?: number
      ts_utc?: string
    }
  ): ArchiveEvent | null
  appendTelemetry(sample: Omit<TelemetrySample, 'session_id' | 'ts_utc' | 't_mono_ms'> & {
    session_id?: string
  }): void
  attachMediaRef(ref: Omit<MediaRef, 'id' | 'session_id'> & { session_id?: string }): void
  sealSession(session_id?: string): void
  stopSession(session_id?: string): void
  getActiveSessionId(): string | null
  getSessionMonoMs(session_id?: string): number
}

export interface IArchiveReader {
  listMissions(): Mission[]
  listSessions(): ArchiveSession[]
  getSession(id: string): SessionBundle | null
  queryEvents(filter: ArchiveEventFilter): ArchiveEvent[]
  getTelemetry(session_id: string, from_mono?: number, to_mono?: number): TelemetrySample[]
  getEngagement(id: string): Engagement | null
  listEngagements(session_id: string): Engagement[]
  exportSessionJson(session_id: string): string
  exportSessionCsv(session_id: string): string
  exportMissionReport(mission_id: string): string
  deleteSession(session_id: string): boolean
}

type InternalSession = {
  meta: ArchiveSession
  t0: number
  events: ArchiveEvent[]
  telemetry: TelemetrySample[]
  media: MediaRef[]
  config: ConfigSnapshot[]
  engagements: Map<string, Engagement>
  openEngagementId: string | null
}

function mapLegacySource(s: string): ArchiveEventSource {
  if (s === 'GAMEPAD' || s === 'HOTKEY') return 'OPERATOR'
  if (s === 'UI' || s === 'HOTKEY' || s === 'OPERATOR') return 'OPERATOR'
  if (s === 'EXTERNAL') return 'EXTERNAL'
  if (s === 'SAFETY') return 'SAFETY'
  return 'SYSTEM'
}

/** Map old HMI EventType strings → archive enum */
export function mapLegacyEventType(type: string): ArchiveEventType {
  const m: Record<string, ArchiveEventType> = {
    CUE_RECEIVED: 'CUE_RECEIVED',
    SLEW: 'CUE_SLEW',
    TRACK_ACQUIRE: 'TRACK_ACQUIRE',
    TRACK_LOST: 'TRACK_LOST',
    ARM: 'LASER_ARM',
    SAFE: 'LASER_SAFE',
    FIRE_START: 'LASER_FIRE_START',
    FIRE_END: 'LASER_FIRE_END',
    MODE_CHANGE: 'MODE_CHANGE',
    CAL_START: 'CAL_START',
    CAL_END: 'CAL_SAVE',
    BITE: 'BITE_RUN',
    FAULT: 'SYSTEM_FAULT',
    REC_START: 'REC_START',
    REC_STOP: 'REC_STOP',
    EFFECTOR: 'EFFECTOR_CMD',
  }
  return m[type] ?? 'SYSTEM_WARN'
}

export class MockArchiveAdapter implements IArchiveWriter, IArchiveReader {
  private missions = new Map<string, Mission>()
  private sessions = new Map<string, InternalSession>()
  private activeId: string | null = null

  constructor() {
    // Seed one demo sealed session for UI
    this.seedDemo()
  }

  private seedDemo() {
    const missionId = 'MIS-2026-08-30-ALPHA'
    this.missions.set(missionId, {
      id: missionId,
      name: 'Shahed wave · East sector',
      created_at: '2026-08-30T15:40:00.000Z',
      session_ids: [],
    })
    const sid = this.startSession({
      mission_id: missionId,
      operator_note: 'Shahed-136, three pulses, soft kill. Preroll 15s from ring.',
      channels: ['LONG', 'IR'],
      software_version: SW_VERSION,
      layout_profile: 'soc',
      parallax: { a: 0.12, c: 180, d: -0.05, e: 95, r0: 2000 },
      calibration_status: 'VALID',
      active_camera: 'LONG',
    })
    const ev = (
      t: number,
      type: ArchiveEvent['type'],
      source: ArchiveEvent['source'],
      message: string,
      payload?: ArchiveEvent['payload']
    ) =>
      this.appendEvent({
        type,
        source,
        message,
        result: 'OK',
        t_mono_ms: t,
        payload,
      })

    ev(4200, 'LINK_CHANGE', 'SYSTEM', 'Turret link OK · GPS 12 sats')
    ev(8400, 'CUE_RECEIVED', 'EXTERNAL', 'Radar R-031 · az 131.2° R≈4.4 km', { az: 131.2, range: 4420 })
    ev(11800, 'CUE_SLEW', 'OPERATOR', 'SLEW to R-031')
    ev(18200, 'TRACK_ACQUIRE', 'SYSTEM', 'Track SHAHED-136  R=4.18 km  Q=91', {
      range: 4180,
      class: 'SHAHED-136',
      quality: 91,
    })
    ev(20000, 'REC_START', 'OPERATOR', 'REC COMBAT LONG+IR · H.265 · flush ring −15s')
    ev(34400, 'LASER_ARM', 'OPERATOR', 'ARM confirm · 1064 nm · 0.45 J', { range: 3410 })
    ev(38200, 'LASER_FIRE_START', 'OPERATOR', 'FIRE #1 · R=3.41 km', { range: 3410 })
    ev(39500, 'LASER_FIRE_END', 'OPERATOR', 'FIRE #1 end · 1.3 s')
    ev(52000, 'LASER_FIRE_START', 'OPERATOR', 'FIRE #2 · R=2.88 km', { range: 2880 })
    ev(52900, 'LASER_FIRE_END', 'OPERATOR', 'FIRE #2 end · 0.9 s')
    ev(61200, 'TRACK_COAST', 'SYSTEM', 'Track coasting 8 s')
    ev(68400, 'TRACK_REACQUIRE', 'SYSTEM', 'Re-acquire  R=2.11 km  Q=84', { range: 2110, quality: 84 })
    ev(74000, 'LASER_ARM', 'OPERATOR', 'ARM confirm')
    ev(78100, 'LASER_FIRE_START', 'OPERATOR', 'FIRE #3 · R=1.94 km', { range: 1940 })
    ev(80400, 'LASER_FIRE_END', 'OPERATOR', 'FIRE #3 end · 2.3 s')
    ev(91200, 'TRACK_LOST', 'SYSTEM', 'Track lost — target not observed')
    ev(92000, 'LASER_SAFE', 'SAFETY', 'SAFE auto after TRACK_LOST')
    ev(96000, 'OPERATOR_NOTE', 'OPERATOR', 'Visual: descent, smoke, heading loss')
    ev(118000, 'REC_STOP', 'OPERATOR', 'REC stop · segments + snapshots')
    ev(124000, 'SESSION_STOP', 'SYSTEM', `Session ${sid} stopped`)

    const s = this.sessions.get(sid)
    if (s) {
      s.t0 = Date.parse('2026-08-30T15:42:12.000Z')
      s.meta.started_at = '2026-08-30T15:42:12.000Z'
      s.meta.ended_at = '2026-08-30T15:44:16.000Z'
      s.meta.duration_sec = 124
      s.meta.sealed = true
      s.meta.had_fire = true
      s.meta.recording = false
      s.meta.operator_note = 'Shahed-136, three pulses, soft kill. Preroll 15s from ring.'
      const eng = [...s.engagements.values()][0]
      if (eng) {
        eng.started_at = '2026-08-30T15:42:30.200Z'
        eng.ended_at = '2026-08-30T15:43:43.200Z'
        eng.duration_sec = 73
        eng.classification = 'SHAHED-136'
        eng.result = 'KILL_SOFT'
        eng.shots_fired = 3
        eng.range_min_m = 1940
        eng.range_max_m = 4180
        eng.max_quality = 91
      }
      const addMedia = (
        t: number,
        channel: 'LONG' | 'IR',
        kind: 'SEGMENT' | 'SNAPSHOT',
        label: string
      ) => {
        s.media.push({
          id: uid('MED'),
          ts_utc: new Date(s.t0 + t).toISOString(),
          t_mono_ms: t,
          session_id: sid,
          channel,
          kind,
          label,
          codec: kind === 'SNAPSHOT' ? 'jpeg' : 'h265',
          container: kind === 'SNAPSHOT' ? 'none' : 'mp4',
          bitrate_kbps: channel === 'LONG' ? 6000 : 2000,
          hw_encoder: false,
        })
      }
      addMedia(5000, 'LONG', 'SEGMENT', 'PREROLL LONG −15s from ring')
      addMedia(5000, 'IR', 'SEGMENT', 'PREROLL IR −15s from ring')
      addMedia(20000, 'LONG', 'SEGMENT', 'seg_0001_t020000_h265.mp4')
      addMedia(20000, 'IR', 'SEGMENT', 'seg_0001_t020000_h265.mp4')
      addMedia(80000, 'LONG', 'SEGMENT', 'seg_0005_t080000_h265.mp4')
      addMedia(38200, 'LONG', 'SNAPSHOT', 't038200_FIRE_START_LONG.jpg')
      s.media.push({
        id: uid('MED'),
        ts_utc: new Date(s.t0 + 23000).toISOString(),
        t_mono_ms: 23000,
        session_id: sid,
        channel: 'LONG',
        kind: 'CLIP',
        label: `media/clips/${eng?.id ?? 'ENG'}_T-15_T+25_long.mp4`,
        codec: 'h265',
        container: 'mp4',
        duration_ms: 40_000,
        bitrate_kbps: 6000,
        hw_encoder: false,
      })
      for (let t = 0; t <= 124000; t += 1000) {
        const firing = (t >= 38200 && t <= 39500) || (t >= 52000 && t <= 52900) || (t >= 78100 && t <= 80400)
        const armed = !firing && t >= 34400 && t < 92000 && !(t >= 61200 && t < 74000)
        const u = Math.min(1, Math.max(0, (t - 18200) / 73000))
        s.telemetry.push({
          ts_utc: new Date(s.t0 + t).toISOString(),
          t_mono_ms: t,
          session_id: sid,
          laser_status: firing ? 'FIRING' : armed ? 'ARMED' : 'SAFE',
          mode: 'MANUAL',
          turret_az: 127.4 + Math.sin((t / 1000) * 0.35) * 1.8,
          turret_el: 8.2 + Math.sin((t / 1000) * 0.22) * 0.7,
          track_state: t < 18200 ? 'SEARCH' : t < 61200 ? 'TRACKING' : t < 68400 ? 'COAST' : t < 91200 ? 'TRACKING' : 'LOST',
          track_range_m: t < 18200 ? null : 4180 + (1940 - 4180) * u,
          track_quality: t < 18200 ? null : t > 91200 ? 0 : 88,
          shot_user: t > 80400 ? 3 : t > 52900 ? 2 : t > 39500 ? 1 : 0,
        })
      }
    }
    this.activeId = null
  }

  getActiveSessionId(): string | null {
    return this.activeId
  }

  getSessionMonoMs(session_id?: string): number {
    const id = session_id ?? this.activeId
    if (!id) return 0
    const s = this.sessions.get(id)
    return s ? Date.now() - s.t0 : 0
  }

  startSession(meta: SessionStartMeta): string {
    const missionId = meta.mission_id ?? `MIS-${new Date().toISOString().slice(0, 10)}`
    if (!this.missions.has(missionId)) {
      this.missions.set(missionId, {
        id: missionId,
        name: missionId,
        created_at: new Date().toISOString(),
        session_ids: [],
      })
    }
    const id = `SES-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`
    const t0 = Date.now()
    const session: ArchiveSession = {
      id,
      mission_id: missionId,
      started_at: new Date(t0).toISOString(),
      duration_sec: 0,
      operator_note: meta.operator_note ?? '',
      sealed: false,
      recording: false,
      channels: meta.channels ?? ['LONG', 'WIDE', 'IR'],
      software_version: meta.software_version || SW_VERSION,
      event_count: 0,
      engagement_count: 0,
      had_fire: false,
      modes: [],
    }
    const internal: InternalSession = {
      meta: session,
      t0,
      events: [],
      telemetry: [],
      media: [],
      config: [],
      engagements: new Map(),
      openEngagementId: null,
    }
    const cfg: ConfigSnapshot = {
      ts_utc: session.started_at,
      t_mono_ms: 0,
      session_id: id,
      software_version: session.software_version,
      layout_profile: meta.layout_profile,
      parallax: { ...meta.parallax },
      calibration_status: meta.calibration_status,
      active_camera: meta.active_camera,
      note: 'SESSION_START snapshot',
    }
    internal.config.push(cfg)
    this.sessions.set(id, internal)
    this.missions.get(missionId)!.session_ids.push(id)
    this.activeId = id

    this.appendEvent({
      type: 'SESSION_START',
      source: 'SYSTEM',
      message: `Session ${id} started`,
      result: 'OK',
      payload: { mission: missionId, version: session.software_version },
    })
    return id
  }

  appendEvent(
    partial: Omit<ArchiveEvent, 'id' | 'ts_utc' | 't_mono_ms' | 'session_id'> & {
      session_id?: string
      t_mono_ms?: number
      ts_utc?: string
    }
  ): ArchiveEvent | null {
    const sid = partial.session_id ?? this.activeId
    if (!sid) return null
    const s = this.sessions.get(sid)
    if (!s || s.meta.sealed) return null

    const now = Date.now()
    const tMono = partial.t_mono_ms ?? now - s.t0
    const ts = partial.ts_utc ?? new Date(s.t0 + tMono).toISOString()
    const ev: ArchiveEvent = {
      id: uid('EVT'),
      ts_utc: ts,
      t_mono_ms: tMono,
      type: partial.type,
      source: partial.source,
      session_id: sid,
      engagement_id: partial.engagement_id,
      track_id: partial.track_id,
      message: partial.message,
      payload: partial.payload,
      result: partial.result ?? 'OK',
    }

    // Engagement lifecycle
    if (
      ev.type === 'TRACK_ACQUIRE' ||
      ev.type === 'TRACK_REACQUIRE' ||
      ev.type === 'CUE_SLEW'
    ) {
      if (!s.openEngagementId) {
        const engId = uid('ENG')
        const range = Number(ev.payload?.range ?? 0)
        const eng: Engagement = {
          id: engId,
          session_id: sid,
          track_id: ev.track_id,
          started_at: ev.ts_utc,
          duration_sec: 0,
          classification: String(ev.payload?.class ?? ev.payload?.classification ?? 'UNK'),
          range_min_m: range || 0,
          range_max_m: range || 0,
          max_quality: Number(ev.payload?.quality ?? 0),
          shots_fired: 0,
          modes_used: [],
          result: 'UNKNOWN',
          event_ids: [ev.id],
        }
        s.engagements.set(engId, eng)
        s.openEngagementId = engId
        s.meta.engagement_count = s.engagements.size
        ev.engagement_id = engId
      } else {
        ev.engagement_id = s.openEngagementId
        const eng = s.engagements.get(s.openEngagementId)!
        eng.event_ids.push(ev.id)
        const range = Number(ev.payload?.range ?? 0)
        if (range) {
          eng.range_min_m = eng.range_min_m ? Math.min(eng.range_min_m, range) : range
          eng.range_max_m = Math.max(eng.range_max_m, range)
        }
        const q = Number(ev.payload?.quality ?? 0)
        if (q > eng.max_quality) eng.max_quality = q
      }
    } else if (s.openEngagementId) {
      ev.engagement_id = ev.engagement_id ?? s.openEngagementId
      const eng = s.engagements.get(s.openEngagementId)!
      eng.event_ids.push(ev.id)
      if (ev.type === 'LASER_FIRE_START' || ev.type === 'LASER_FIRE_END') {
        if (ev.type === 'LASER_FIRE_START') eng.shots_fired += 1
        s.meta.had_fire = true
      }
      if (ev.type === 'MODE_CHANGE' && ev.payload?.to) {
        const m = String(ev.payload.to) as OperationMode
        if (!eng.modes_used.includes(m)) eng.modes_used.push(m)
      }
      if (ev.type === 'TRACK_LOST' || ev.type === 'LASER_SAFE') {
        eng.ended_at = ev.ts_utc
        eng.duration_sec = Math.max(
          0,
          Math.round((new Date(eng.ended_at).getTime() - new Date(eng.started_at).getTime()) / 1000)
        )
        eng.result = this.inferEngagementResult(eng)
        s.openEngagementId = null
      }
    }

    if (ev.type === 'MODE_CHANGE' && ev.payload?.to) {
      const m = String(ev.payload.to) as OperationMode
      if (!s.meta.modes.includes(m)) s.meta.modes.push(m)
    }
    if (ev.type === 'REC_START') s.meta.recording = true
    if (ev.type === 'REC_STOP') s.meta.recording = false

    s.events.push(ev)
    s.meta.event_count = s.events.length
    s.meta.duration_sec = Math.max(s.meta.duration_sec, Math.round(tMono / 1000))
    return ev
  }

  private inferEngagementResult(eng: Engagement): EngagementResult {
    if (eng.shots_fired > 0) return 'KILL_SOFT' // demo heuristic only
    if (eng.event_ids.length <= 1) return 'ABORT'
    return 'NO_EFFECT'
  }

  appendTelemetry(
    sample: Omit<TelemetrySample, 'session_id' | 'ts_utc' | 't_mono_ms'> & {
      session_id?: string
    }
  ): void {
    const sid = sample.session_id ?? this.activeId
    if (!sid) return
    const s = this.sessions.get(sid)
    if (!s || s.meta.sealed) return
    const now = Date.now()
    s.telemetry.push({
      ...sample,
      session_id: sid,
      ts_utc: new Date(now).toISOString(),
      t_mono_ms: now - s.t0,
    })
    const firing = sample.laser_status === 'FIRING' || Boolean(s.openEngagementId)
    const cap = firing ? 18000 : 3600
    if (s.telemetry.length > cap) s.telemetry.splice(0, s.telemetry.length - cap)
  }

  attachMediaRef(ref: Omit<MediaRef, 'id' | 'session_id'> & { session_id?: string }): void {
    const sid = ref.session_id ?? this.activeId
    if (!sid) return
    const s = this.sessions.get(sid)
    if (!s || s.meta.sealed) return
    s.media.push({
      ...ref,
      id: uid('MED'),
      session_id: sid,
    })
  }

  sealSession(session_id?: string): void {
    const id = session_id ?? this.activeId
    if (!id) return
    const s = this.sessions.get(id)
    if (!s) return
    s.meta.sealed = true
  }

  stopSession(session_id?: string): void {
    const id = session_id ?? this.activeId
    if (!id) return
    const s = this.sessions.get(id)
    if (!s) return
    if (s.openEngagementId) {
      const eng = s.engagements.get(s.openEngagementId)!
      eng.ended_at = new Date().toISOString()
      eng.duration_sec = Math.max(
        0,
        Math.round((Date.now() - new Date(eng.started_at).getTime()) / 1000)
      )
      eng.result = this.inferEngagementResult(eng)
      s.openEngagementId = null
    }
    this.appendEvent({
      type: 'SESSION_STOP',
      source: 'SYSTEM',
      message: `Session ${id} stopped`,
      result: 'OK',
      session_id: id,
    })
    s.meta.ended_at = new Date().toISOString()
    s.meta.duration_sec = Math.round((Date.now() - s.t0) / 1000)
    if (this.activeId === id) this.activeId = null
  }

  listMissions(): Mission[] {
    return [...this.missions.values()]
  }

  listSessions(): ArchiveSession[] {
    return [...this.sessions.values()]
      .map((s) => ({ ...s.meta, engagement_count: s.engagements.size }))
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  }

  getSession(id: string): SessionBundle | null {
    const s = this.sessions.get(id)
    if (!s) return null
    return {
      session: { ...s.meta, engagement_count: s.engagements.size },
      events: [...s.events],
      telemetry: [...s.telemetry],
      media: [...s.media],
      config: [...s.config],
      engagements: [...s.engagements.values()],
    }
  }

  queryEvents(filter: ArchiveEventFilter): ArchiveEvent[] {
    let list: ArchiveEvent[] = []
    if (filter.session_id) {
      const s = this.sessions.get(filter.session_id)
      list = s ? [...s.events] : []
    } else {
      for (const s of this.sessions.values()) list.push(...s.events)
    }
    if (filter.types?.length) list = list.filter((e) => filter.types!.includes(e.type))
    if (filter.from_utc) list = list.filter((e) => e.ts_utc >= filter.from_utc!)
    if (filter.to_utc) list = list.filter((e) => e.ts_utc <= filter.to_utc!)
    return list.sort((a, b) => (a.ts_utc < b.ts_utc ? 1 : -1))
  }

  getTelemetry(session_id: string, from_mono?: number, to_mono?: number): TelemetrySample[] {
    const s = this.sessions.get(session_id)
    if (!s) return []
    return s.telemetry.filter((t) => {
      if (from_mono != null && t.t_mono_ms < from_mono) return false
      if (to_mono != null && t.t_mono_ms > to_mono) return false
      return true
    })
  }

  getEngagement(id: string): Engagement | null {
    for (const s of this.sessions.values()) {
      const e = s.engagements.get(id)
      if (e) return e
    }
    return null
  }

  listEngagements(session_id: string): Engagement[] {
    const s = this.sessions.get(session_id)
    return s ? [...s.engagements.values()] : []
  }

  exportSessionJson(session_id: string): string {
    const bundle = this.getSession(session_id)
    if (!bundle) return '{}'
    return JSON.stringify(bundle, null, 2)
  }

  exportSessionCsv(session_id: string): string {
    const bundle = this.getSession(session_id)
    if (!bundle) return ''
    const lines = [
      'engagement_id,started_at,ended_at,duration_sec,classification,range_min_m,range_max_m,max_quality,shots_fired,result',
    ]
    for (const e of bundle.engagements) {
      lines.push(
        [
          e.id,
          e.started_at,
          e.ended_at ?? '',
          e.duration_sec,
          e.classification,
          e.range_min_m,
          e.range_max_m,
          e.max_quality,
          e.shots_fired,
          e.result,
        ].join(',')
      )
    }
    lines.push('')
    lines.push('event_id,ts_utc,t_mono_ms,type,source,result,message')
    for (const ev of bundle.events) {
      lines.push(
        [
          ev.id,
          ev.ts_utc,
          ev.t_mono_ms,
          ev.type,
          ev.source,
          ev.result,
          `"${ev.message.replace(/"/g, '""')}"`,
        ].join(',')
      )
    }
    return lines.join('\n')
  }

  exportMissionReport(mission_id: string): string {
    const mission = this.missions.get(mission_id)
    if (!mission) return '{}'
    const sessions = mission.session_ids
      .map((id) => this.getSession(id))
      .filter(Boolean)
    return JSON.stringify(
      {
        mission,
        sessions: sessions.map((b) => ({
          session: b!.session,
          engagements: b!.engagements,
          event_count: b!.events.length,
          had_fire: b!.session.had_fire,
        })),
        generated_at: new Date().toISOString(),
        software_version: SW_VERSION,
      },
      null,
      2
    )
  }

  deleteSession(session_id: string): boolean {
    const s = this.sessions.get(session_id)
    if (!s || s.meta.sealed) return false
    const mid = s.meta.mission_id
    this.sessions.delete(session_id)
    const m = this.missions.get(mid)
    if (m) m.session_ids = m.session_ids.filter((id) => id !== session_id)
    if (this.activeId === session_id) this.activeId = null
    return true
  }
}

/** Singleton used by HMI store */
export const archiveMock = new MockArchiveAdapter()

export { mapLegacySource, SW_VERSION }
