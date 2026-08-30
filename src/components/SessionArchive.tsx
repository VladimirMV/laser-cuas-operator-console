/**
 * Mission Archives — session list, event timeline, engagements, export.
 * Demo replay slider restores visual state only (no real FIRE).
 */
import { useMemo, useState } from 'react'
import {
  Archive, Circle, Download, Lock, Trash2, Play, ChevronRight,
} from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { ArchiveEvent, Engagement, SessionBundle } from '../types/archive'
import { archiveMock } from '../adapters/archive'

type Tab = 'events' | 'telemetry' | 'engagements' | 'media' | 'config'

function eventColor(type: string): string {
  if (type.includes('FIRE') || type.includes('LOST') || type.includes('FAULT'))
    return 'text-[#F85149]'
  if (type.includes('ARM') || type.includes('WARN') || type.includes('COAST'))
    return 'text-[#D29922]'
  if (type.includes('TRACK') || type.includes('SAFE') || type.includes('ACQUIRE'))
    return 'text-[#3FB950]'
  return 'text-[#58A6FF]'
}

export function SessionArchive() {
  const {
    closeSessions,
    recording,
    toggleRecording,
    eventLog,
    laserStatus,
    listArchiveSessions,
    getArchiveBundle,
    exportArchiveSessionJson,
    exportArchiveSessionCsv,
    deleteArchiveSession,
    ensureArchiveSession,
    recordingProfile,
    recordingChannels,
    recordingActualCodec,
    setRecordingPreset,
    setRecChannel,
    setRecordingCodec,
  } = useHmiStore()
  const { t } = useT()

  const [sessions, setSessions] = useState(() => listArchiveSessions())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('events')
  const [selectedEvent, setSelectedEvent] = useState<ArchiveEvent | null>(null)
  const [replayMs, setReplayMs] = useState(0)
  const [filterFire, setFilterFire] = useState(false)

  const refresh = () => setSessions(listArchiveSessions())

  const bundle: SessionBundle | null = useMemo(
    () => (selectedId ? getArchiveBundle(selectedId) : null),
    [selectedId, sessions, getArchiveBundle]
  )

  const liveMode = !selectedId

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const downloadText = (text: string, name: string, mime: string) => {
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredSessions = filterFire ? sessions.filter((s) => s.had_fire) : sessions

  const timelineEvents: ArchiveEvent[] = liveMode
    ? eventLog.map((e) => ({
        id: e.id,
        ts_utc: e.ts,
        t_mono_ms: 0,
        type: e.type as ArchiveEvent['type'],
        source: (e.source === 'UI' || e.source === 'HOTKEY'
          ? 'OPERATOR'
          : e.source === 'EXTERNAL'
            ? 'EXTERNAL'
            : 'SYSTEM') as ArchiveEvent['source'],
        session_id: 'LIVE',
        message: e.message,
        payload: e.payload,
        result: 'OK' as const,
      }))
    : bundle?.events.slice().reverse() ?? []

  const maxMono = bundle?.events.reduce((m, e) => Math.max(m, e.t_mono_ms), 0) ?? 0

  const telNear = (ev: ArchiveEvent | null) => {
    if (!ev || !bundle) return []
    return bundle.telemetry.filter(
      (t) => Math.abs(t.t_mono_ms - ev.t_mono_ms) <= 2000
    )
  }

  const onDelete = (id: string) => {
    if (laserStatus !== 'SAFE') return
    if (deleteArchiveSession(id)) {
      if (selectedId === id) setSelectedId(null)
      refresh()
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'events', label: t('archEvents') },
    { id: 'telemetry', label: t('archTelemetry') },
    { id: 'engagements', label: t('archEngagements') },
    { id: 'media', label: t('archMedia') },
    { id: 'config', label: t('archConfig') },
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-5xl shadow-2xl max-h-[94vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#30363D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-[#58A6FF]" />
            <div>
              <h2 className="text-base font-semibold">{t('archives')}</h2>
              <p className="text-xs text-[#8B949E]">{t('archivesSub')}</p>
            </div>
          </div>
          <button onClick={closeSessions} className="text-[#8B949E] hover:text-[#E6EDF3] font-mono px-2">
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-[#30363D] flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={toggleRecording}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono font-semibold',
              recording
                ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/10 animate-pulse'
                : 'border-[#30363D] text-[#8B949E] hover:border-[#F85149]/50'
            )}
          >
            <Circle size={10} fill={recording ? '#F85149' : 'transparent'} />
            {recording ? t('stopRec') : t('startRec')}
          </button>

          {(['LONG', 'WIDE', 'IR'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setRecChannel(ch, !recordingProfile.channels[ch])}
              className={cn(
                'px-2 py-1 rounded border text-[10px] font-mono font-bold transition-colors',
                recordingProfile.channels[ch]
                  ? recording && recordingChannels.includes(ch)
                    ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/10'
                    : 'border-[#3FB950] text-[#3FB950] bg-[#3FB950]/10'
                  : 'border-[#30363D] text-[#6E7681]'
              )}
              title={t('recChannels')}
            >
              {ch}
            </button>
          ))}

          <select
            value={recordingProfile.mode}
            onChange={(e) =>
              setRecordingPreset(
                e.target.value as 'ALL' | 'COMBAT' | 'ACQ' | 'CUSTOM' | 'ON_ENGAGEMENT'
              )
            }
            className="bg-[#0D1117] border border-[#30363D] rounded px-2 py-1 text-[10px] font-mono text-[#E6EDF3]"
            title={t('recPreset')}
          >
            <option value="COMBAT">{t('recCombat')}</option>
            <option value="ALL">{t('recAll')}</option>
            <option value="ACQ">{t('recAcq')}</option>
            <option value="CUSTOM">{t('recCustom')}</option>
            <option value="ON_ENGAGEMENT">{t('recOnEngagement')}</option>
          </select>

          <select
            value={recordingProfile.codec}
            onChange={(e) => setRecordingCodec(e.target.value as 'h265' | 'h264')}
            className="bg-[#0D1117] border border-[#30363D] rounded px-2 py-1 text-[10px] font-mono text-[#E6EDF3]"
            title={t('recCodec')}
          >
            <option value="h265">{t('recCodecH265')}</option>
            <option value="h264">{t('recCodecH264')}</option>
          </select>

          <span
            className={cn(
              'px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
              recordingActualCodec === 'h265'
                ? 'border-[#3FB950]/50 text-[#3FB950]'
                : recordingActualCodec === 'h264'
                  ? 'border-[#D29922]/50 text-[#D29922]'
                  : 'border-[#58A6FF]/50 text-[#58A6FF]'
            )}
          >
            {recording
              ? recordingActualCodec.toUpperCase()
              : `${recordingProfile.codec.toUpperCase()} tgt`}
          </span>

          <button
            onClick={() => {
              ensureArchiveSession()
              refresh()
            }}
            className="px-2 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {t('archRefresh')}
          </button>
          <label className="flex items-center gap-1.5 text-[10px] font-mono text-[#8B949E] cursor-pointer">
            <input
              type="checkbox"
              checked={filterFire}
              onChange={(e) => setFilterFire(e.target.checked)}
              className="accent-[#F85149]"
            />
            {t('archFilterFire')}
          </label>
          {selectedId && (
            <>
              <button
                onClick={() =>
                  downloadText(
                    exportArchiveSessionJson(selectedId),
                    `${selectedId}.json`,
                    'application/json'
                  )
                }
                className="flex items-center gap-1 px-2 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
              >
                <Download size={11} /> JSON
              </button>
              <button
                onClick={() =>
                  downloadText(
                    exportArchiveSessionCsv(selectedId),
                    `${selectedId}.csv`,
                    'text/csv'
                  )
                }
                className="flex items-center gap-1 px-2 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
              >
                <Download size={11} /> CSV
              </button>
            </>
          )}
          <span className="text-[10px] text-[#6E7681] font-mono ml-auto">
            {t('eventLogAlways')}
          </span>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Session list */}
          <div className="w-[280px] border-r border-[#30363D] overflow-y-auto shrink-0">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-[#161B22] z-10">
                <tr className="text-[#8B949E] border-b border-[#30363D]">
                  <th className="py-2 px-3 text-left">{t('sessionId')}</th>
                  <th className="py-2 px-2 text-right">{t('events')}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={cn(
                    'border-b border-[#21262D] cursor-pointer',
                    liveMode ? 'bg-[#0D1117]' : 'hover:bg-[#0D1117]'
                  )}
                  onClick={() => {
                    setSelectedId(null)
                    setSelectedEvent(null)
                    setTab('events')
                  }}
                >
                  <td className="py-2 px-3">
                    <div className="text-[#58A6FF]">{t('liveLog')}</div>
                    <div className="text-[#8B949E] text-[10px]">
                      {eventLog.length} events · active
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-[#E6EDF3]">{eventLog.length}</td>
                </tr>
                {filteredSessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedId(s.id)
                      setSelectedEvent(null)
                      setReplayMs(0)
                      setTab('events')
                    }}
                    className={cn(
                      'border-b border-[#21262D] cursor-pointer',
                      selectedId === s.id ? 'bg-[#0D1117]' : 'hover:bg-[#0D1117]'
                    )}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 text-[#E6EDF3]">
                        {s.sealed && <Lock size={10} className="text-[#D29922]" />}
                        {s.id}
                      </div>
                      <div className="text-[#8B949E] text-[10px]">
                        {fmtDur(s.duration_sec)}
                        {s.had_fire ? ' · FIRE' : ''}
                        {s.engagement_count ? ` · ${s.engagement_count} eng` : ''}
                      </div>
                      {s.operator_note && (
                        <div className="text-[#6E7681] text-[9px] truncate max-w-[200px]">
                          {s.operator_note}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="text-[#E6EDF3]">{s.event_count}</div>
                      {!s.sealed && laserStatus === 'SAFE' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(s.id)
                          }}
                          className="text-[#6E7681] hover:text-[#F85149] mt-1"
                          title={t('archDelete')}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {!liveMode && (
              <div className="flex gap-1 px-3 py-2 border-b border-[#30363D] shrink-0 overflow-x-auto">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setTab(tb.id)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-mono font-semibold border transition-colors',
                      tab === tb.id
                        ? 'border-[#58A6FF] text-[#58A6FF] bg-[#58A6FF]/10'
                        : 'border-transparent text-[#8B949E] hover:text-[#E6EDF3]'
                    )}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
            )}

            {/* Replay slider (archived only) */}
            {!liveMode && bundle && maxMono > 0 && (
              <div className="px-3 py-2 border-b border-[#30363D] flex items-center gap-2 shrink-0">
                <Play size={12} className="text-[#8B949E]" />
                <span className="text-[10px] font-mono text-[#8B949E]">{t('archReplay')}</span>
                <input
                  type="range"
                  min={0}
                  max={maxMono}
                  value={replayMs}
                  onChange={(e) => setReplayMs(Number(e.target.value))}
                  className="flex-1 accent-[#58A6FF]"
                />
                <span className="text-[10px] font-mono text-[#E6EDF3] w-16 text-right">
                  {(replayMs / 1000).toFixed(1)}s
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
              {/* Events tab / live */}
              {(liveMode || tab === 'events') && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-2">
                    {t('timeline')} · {liveMode ? t('liveLog') : selectedId}
                  </div>
                  {timelineEvents.length === 0 && (
                    <div className="text-xs text-[#8B949E] py-6 text-center">{t('noEvents')}</div>
                  )}
                  {timelineEvents
                    .filter((e) => liveMode || e.t_mono_ms <= replayMs || replayMs === 0)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setSelectedEvent(e)}
                        className={cn(
                          'w-full flex gap-2 text-[11px] font-mono border-b border-[#21262D] py-1.5 text-left hover:bg-[#0D1117]',
                          selectedEvent?.id === e.id && 'bg-[#0D1117]'
                        )}
                      >
                        <span className="text-[#6E7681] shrink-0 w-[72px]">
                          {e.ts_utc.slice(11, 19)}
                        </span>
                        <span className={cn('shrink-0 w-[120px] font-semibold truncate', eventColor(e.type))}>
                          {e.type}
                        </span>
                        <span className="text-[#E6EDF3] truncate flex-1">{e.message}</span>
                        <span className="text-[#6E7681] shrink-0">{e.source}</span>
                        <ChevronRight size={12} className="text-[#30363D] shrink-0" />
                      </button>
                    ))}

                  {selectedEvent && (
                    <div className="mt-3 p-3 rounded border border-[#30363D] bg-[#0D1117] text-[11px] font-mono space-y-1">
                      <div className="text-[#58A6FF] font-semibold">{selectedEvent.type}</div>
                      <div className="text-[#8B949E]">
                        {selectedEvent.ts_utc} · mono {selectedEvent.t_mono_ms} ms · {selectedEvent.result}
                      </div>
                      <div className="text-[#E6EDF3]">{selectedEvent.message}</div>
                      {selectedEvent.payload && (
                        <pre className="text-[10px] text-[#8B949E] overflow-x-auto">
                          {JSON.stringify(selectedEvent.payload, null, 2)}
                        </pre>
                      )}
                      {!liveMode && telNear(selectedEvent).length > 0 && (
                        <div className="pt-2 border-t border-[#21262D]">
                          <div className="text-[#8B949E] mb-1">{t('archTelNear')}</div>
                          {telNear(selectedEvent).slice(0, 5).map((t, i) => (
                            <div key={i} className="text-[10px] text-[#E6EDF3]">
                              t={t.t_mono_ms}ms · {t.laser_status} · R=
                              {t.track_range_m ?? '—'} · az={t.turret_az?.toFixed(1)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Telemetry */}
              {!liveMode && tab === 'telemetry' && bundle && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#8B949E] font-mono mb-2">
                    {bundle.telemetry.length} samples
                  </div>
                  {bundle.telemetry.length === 0 && (
                    <div className="text-xs text-[#8B949E] py-6 text-center">{t('archNoTelemetry')}</div>
                  )}
                  {bundle.telemetry
                    .filter((t) => t.t_mono_ms <= replayMs || replayMs === 0)
                    .slice(-80)
                    .reverse()
                    .map((t, i) => (
                      <div key={i} className="text-[10px] font-mono text-[#E6EDF3] border-b border-[#21262D] py-1 flex gap-3">
                        <span className="text-[#6E7681] w-14">{(t.t_mono_ms / 1000).toFixed(1)}s</span>
                        <span className={eventColor(t.laser_status)}>{t.laser_status}</span>
                        <span>{t.mode}</span>
                        <span>R {t.track_range_m ?? '—'}</span>
                        <span className="text-[#8B949E]">
                          {t.temp_head_c?.toFixed(0)}°C · {t.shot_user} shots
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Engagements */}
              {!liveMode && tab === 'engagements' && bundle && (
                <div className="space-y-2">
                  {bundle.engagements.length === 0 && (
                    <div className="text-xs text-[#8B949E] py-6 text-center">{t('archNoEngagements')}</div>
                  )}
                  {bundle.engagements.map((eng: Engagement) => (
                    <div
                      key={eng.id}
                      className="p-3 rounded border border-[#30363D] bg-[#0D1117] font-mono text-[11px] space-y-1"
                    >
                      <div className="flex justify-between">
                        <span className="text-[#58A6FF] font-semibold">{eng.id}</span>
                        <span
                          className={cn(
                            'font-semibold',
                            eng.result === 'KILL_SOFT'
                              ? 'text-[#3FB950]'
                              : eng.result === 'ABORT'
                                ? 'text-[#D29922]'
                                : 'text-[#8B949E]'
                          )}
                        >
                          {eng.result}
                        </span>
                      </div>
                      <div className="text-[#E6EDF3]">
                        {eng.classification} · {fmtDur(eng.duration_sec)} · shots {eng.shots_fired}
                      </div>
                      <div className="text-[#8B949E]">
                        R {eng.range_min_m.toFixed(0)}–{eng.range_max_m.toFixed(0)} m · Qmax{' '}
                        {eng.max_quality}
                      </div>
                      <div className="text-[#6E7681] text-[10px]">
                        {eng.started_at.slice(11, 19)}
                        {eng.ended_at ? ` → ${eng.ended_at.slice(11, 19)}` : ' → …'}
                        {' · '}
                        {eng.event_ids.length} events
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Media */}
              {!liveMode && tab === 'media' && bundle && (
                <div className="space-y-1">
                  {bundle.media.length === 0 && (
                    <div className="text-xs text-[#8B949E] py-6 text-center">{t('archNoMedia')}</div>
                  )}
                  <div className="text-[10px] text-[#6E7681] font-mono mb-2">{t('recCodecHint')}</div>
                  {bundle.media.map((m) => (
                    <div
                      key={m.id}
                      className="text-[11px] font-mono border-b border-[#21262D] py-1.5 flex gap-2 flex-wrap"
                    >
                      <span className="text-[#6E7681] w-[64px]">{m.ts_utc.slice(11, 19)}</span>
                      <span className="text-[#58A6FF] w-12">{m.channel}</span>
                      <span className="text-[#D29922] w-16">{m.kind}</span>
                      <span
                        className={
                          m.codec === 'h265'
                            ? 'text-[#3FB950]'
                            : m.codec === 'meta'
                              ? 'text-[#58A6FF]'
                              : 'text-[#8B949E]'
                        }
                      >
                        {(m.codec ?? 'meta').toUpperCase()}
                      </span>
                      {m.bitrate_kbps != null && (
                        <span className="text-[#6E7681]">{m.bitrate_kbps} kbps</span>
                      )}
                      <span className="text-[#E6EDF3] flex-1 truncate">{m.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Config */}
              {!liveMode && tab === 'config' && bundle && (
                <div className="space-y-2">
                  {bundle.config.map((c, i) => (
                    <pre
                      key={i}
                      className="text-[10px] font-mono text-[#E6EDF3] p-2 rounded border border-[#30363D] bg-[#0D1117] overflow-x-auto"
                    >
                      {JSON.stringify(c, null, 2)}
                    </pre>
                  ))}
                  {bundle.config.length === 0 && (
                    <div className="text-xs text-[#8B949E] py-6 text-center">—</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[#30363D] flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono text-[#6E7681]">
            {archiveMock.getActiveSessionId()
              ? `active: ${archiveMock.getActiveSessionId()}`
              : 'no active archive session'}
          </span>
          <button
            onClick={closeSessions}
            className="px-4 py-2 rounded border border-[#30363D] text-sm font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
