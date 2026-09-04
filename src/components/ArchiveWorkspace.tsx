/**
 * Archive workspace — session list, synced replay, timeline, export.
 * Visual-only: never commands laser / PTZ.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Circle, Download, Lock, Trash2, Play, Pause, SkipBack, SkipForward, Film,
} from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'
import type { ArchiveEvent, MediaRef, SessionBundle } from '../types/archive'
import type { CameraChannel } from '../types/hmi'
import { archiveMock } from '../adapters/archive'
import { DEFAULT_SIDECAR_URL, HttpMediaRecorder } from '../adapters/mediaRecorder'
import { ReplayCanvas } from './ReplayCanvas'
import { eventColor, eventMarker, fmtClock, hudFromBundle } from '../lib/replayHud'

type Layout = 'split' | 'pip' | 'single'

function segmentFor(bundle: SessionBundle, channel: CameraChannel, t: number): MediaRef | null {
  const segs = bundle.media
    .filter((m) => m.channel === channel && (m.kind === 'SEGMENT' || m.kind === 'CLIP') && m.url)
    .sort((a, b) => a.t_mono_ms - b.t_mono_ms)
  if (!segs.length) return null
  const rec = segs.find((s) => /rec\.mp4(\?|$)/i.test(s.url || '') || /session/i.test(s.label || ''))
  if (rec) return rec
  let cur = segs[0]
  for (const s of segs) {
    if (s.t_mono_ms <= t) cur = s
    else break
  }
  return cur
}

function ReplayFeed({
  bundle, channel, hud, playhead, className,
}: {
  bundle: SessionBundle
  channel: CameraChannel
  hud: ReturnType<typeof hudFromBundle>
  playhead: number
  className?: string
}) {
  const vid = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [broken, setBroken] = useState(false)
  const seg = hud ? segmentFor(bundle, channel, playhead) : null
  const url = seg?.url
  useEffect(() => {
    setReady(false)
    setBroken(false)
  }, [url])
  useEffect(() => {
    const el = vid.current
    if (!el || !url || !seg) return
    const durMs = seg.duration_ms && seg.duration_ms > 0 ? seg.duration_ms : (el.duration || 0) * 1000
    const off = durMs > 0 ? Math.min(playhead, durMs - 80) / 1000 : playhead / 1000
    if (Math.abs(el.currentTime - off) > 0.4) {
      try { el.currentTime = Math.max(0, off) } catch { /* */ }
    }
  }, [playhead, url, seg])
  useEffect(() => {
    const el = vid.current
    if (!el || !url) return
    const play = () => { void el.play().catch(() => undefined) }
    el.addEventListener('loadeddata', play)
    play()
    return () => el.removeEventListener('loadeddata', play)
  }, [url])
  return (
    <div className={className}>
      {url && (
        <video
          ref={vid}
          src={url}
          muted
          playsInline
          preload="auto"
          onLoadedData={() => { setReady(true); setBroken(false) }}
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover bg-black"
        />
      )}
      <ReplayCanvas channel={channel} hud={hud!} t={playhead} hasVideo={ready && !broken} className="absolute inset-0 h-full w-full pointer-events-none" />
      {(!url || broken) && (
        <div className="absolute bottom-3 left-3 z-10 font-mono text-[10px] tracking-widest text-[#F85149] bg-black/70 px-2 py-1">
          {broken ? 'VIDEO NOT PLAYABLE' : 'NO VIDEO — REC then Stop, wait remux, Оновити'}
        </div>
      )}
    </div>
  )
}


export function ArchiveWorkspace() {
  const {
    closeSessions, recording, toggleRecording, eventLog, laserStatus,
    listArchiveSessions, getArchiveBundle, exportArchiveSessionJson, exportArchiveSessionCsv,
    deleteArchiveSession, ensureArchiveSession, recordingProfile, setRecordingPreset,
    setRecChannel, setRecordingCodec, recordingActualCodec,
    sidecarConnected, mediaRoot, exportEngagementClip, ringHot,
  } = useHmiStore()
  const { t } = useT()

  const [sessions, setSessions] = useState(() => listArchiveSessions())
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null)
  const [playhead, setPlayhead] = useState(38_200)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [layout, setLayout] = useState<Layout>('split')
  const [ch, setCh] = useState<CameraChannel>('LONG')
  const [irOn, setIrOn] = useState(true)
  const [filterFire, setFilterFire] = useState(false)

  const refresh = () => setSessions(listArchiveSessions())
  useEffect(() => {
    refresh()
  }, [sidecarConnected, ringHot])
  useEffect(() => {
    if (!selectedId || selectedId === 'LIVE' || selectedId === 'RING') return
    void HttpMediaRecorder.fetchSessionIndex(selectedId).then((refs) => {
      if (!refs.length) return
      archiveMock.replaceSessionMedia(selectedId, refs)
      refresh()
    })
  }, [selectedId])
  const bundle: SessionBundle | null = useMemo(
    () => (selectedId ? getArchiveBundle(selectedId) : null),
    [selectedId, sessions, getArchiveBundle]
  )
  useEffect(() => {
    if (!selectedId) return
    const b = getArchiveBundle(selectedId)
    const rs = b?.events.find((e) => e.type === 'REC_START')
    setPlayhead(rs?.t_mono_ms ?? 0)
  }, [selectedId, getArchiveBundle])
  const liveMode = !selectedId
  const maxMono = bundle
    ? Math.max(
        bundle.events.reduce((m, e) => Math.max(m, e.t_mono_ms), 0),
        (bundle.session.duration_sec ?? 0) * 1000
      )
    : 0
  const recStart = bundle?.events.find((e) => e.type === 'REC_START')?.t_mono_ms ?? 0
  const preroll = 15_000

  useEffect(() => {
    if (!playing || !bundle) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false)
      return
    }
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      setPlayhead((cur) => {
        const next = cur + dt * rate
        if (next >= maxMono) {
          setPlaying(false)
          return maxMono
        }
        return next
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, rate, bundle, maxMono])

  useEffect(() => {
    const el = document.querySelector('[data-active-event="1"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [playhead])

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
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
  const jumpTo = (ms: number) => {
    setPlayhead(Math.max(0, Math.min(maxMono, ms)))
    setPlaying(false)
  }
  const onDelete = (id: string) => {
    if (laserStatus !== 'SAFE') return
    if (deleteArchiveSession(id)) {
      if (selectedId === id) setSelectedId(null)
      refresh()
    }
  }

  const filtered = filterFire ? sessions.filter((s) => s.had_fire) : sessions
  const hud = bundle ? hudFromBundle(bundle, playhead) : null
  const showIr = irOn && !!bundle?.session.channels.includes('IR') && layout !== 'single'
  const timelineEvents: ArchiveEvent[] = liveMode
    ? eventLog.map((e) => ({
        id: e.id,
        ts_utc: e.ts,
        t_mono_ms: 0,
        type: e.type as ArchiveEvent['type'],
        source: 'OPERATOR',
        session_id: 'LIVE',
        message: e.message,
        payload: e.payload,
        result: 'OK',
      }))
    : bundle?.events ?? []

  const jumps = useMemo(() => {
    if (!bundle) return []
    const pick = (type: string) => bundle.events.find((e) => e.type === type)?.t_mono_ms
    return [
      { label: t('jumpCue'), t: pick('CUE_RECEIVED') },
      { label: t('jumpTrack'), t: pick('TRACK_ACQUIRE') },
      { label: t('jumpArm'), t: pick('LASER_ARM') },
      { label: t('jumpFire'), t: pick('LASER_FIRE_START') },
      { label: t('jumpLost'), t: pick('TRACK_LOST') },
    ].filter((j) => j.t != null) as { label: string; t: number }[]
  }, [bundle, t])

  const barRef = useRef<HTMLDivElement>(null)
  const onSeek = (clientX: number) => {
    const el = barRef.current
    if (!el || !maxMono) return
    const r = el.getBoundingClientRect()
    const u = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setPlayhead(u * maxMono)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col border border-[#30363D] bg-[#161B22] rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-[#30363D] flex items-center gap-2 shrink-0">
        <Archive size={14} className="text-[#58A6FF]" />
        <div className="min-w-0">
          <div className="text-xs font-semibold">{t('archives')}</div>
          <div className="text-[10px] font-mono text-[#8B949E]">
            {t('archLiveLaser')} · {laserStatus}{sidecarConnected ? ` · DISK ${mediaRoot}` : ' · META'}
          </div>
        </div>
        <span className="ml-2 hidden sm:inline rounded border border-[#58A6FF]/40 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#58A6FF]">
          {t('replayBanner')}
        </span>
        <button
          onClick={toggleRecording}
          className={cn(
            'ml-auto flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-semibold',
            recording
              ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/10'
              : 'border-[#30363D] text-[#8B949E]'
          )}
        >
          <Circle size={8} fill={recording ? '#F85149' : 'transparent'} />
          {recording ? t('stopRec') : t('startRec')}
        </button>
        {(['LONG', 'WIDE', 'IR'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setRecChannel(c, !recordingProfile.channels[c])}
            disabled={recording}
            className={cn(
              'px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold',
              recording && 'opacity-50 cursor-not-allowed',
              recordingProfile.channels[c]
                ? 'border-[#3FB950] text-[#3FB950]'
                : 'border-[#30363D] text-[#6E7681]'
            )}
          >
            {c}
          </button>
        ))}
        <select
          value={recordingProfile.mode}
          onChange={(e) => setRecordingPreset(e.target.value as typeof recordingProfile.mode)}
          className="bg-[#0D1117] border border-[#30363D] rounded px-1 py-0.5 text-[10px] font-mono"
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
          className="bg-[#0D1117] border border-[#30363D] rounded px-1 py-0.5 text-[10px] font-mono"
        >
          <option value="h265">H.265</option>
          <option value="h264">H.264</option>
        </select>
        <button
          onClick={() => { ensureArchiveSession(); refresh() }}
          className="px-2 py-1 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E]"
        >
          {t('archRefresh')}
        </button>
        <button onClick={closeSessions} className="text-[#8B949E] hover:text-[#E6EDF3] font-mono px-2">✕</button>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="w-full md:w-[260px] border-b md:border-b-0 md:border-r border-[#30363D] overflow-y-auto shrink-0 max-h-36 md:max-h-none">
          <table className="w-full text-xs font-mono">
            <tbody>
              <tr
                className={cn('border-b border-[#21262D] cursor-pointer', liveMode && 'bg-[#0D1117]')}
                onClick={() => { setSelectedId(null); setPlaying(false) }}
              >
                <td className="py-2 px-3">
                  <div className="text-[#58A6FF]">{t('liveLog')}</div>
                  <div className="text-[#8B949E] text-[10px]">{eventLog.length} events</div>
                </td>
              </tr>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id)
                    setPlayhead(s.had_fire ? 38_200 : 0)
                    setPlaying(false)
                    setCh(s.channels[0] ?? 'LONG')
                    setIrOn(s.channels.includes('IR'))
                  }}
                  className={cn('border-b border-[#21262D] cursor-pointer', selectedId === s.id && 'bg-[#0D1117]')}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 text-[#E6EDF3]">
                      {s.sealed && <Lock size={10} className="text-[#D29922]" />}
                      {s.id.replace('SES-', 'SES ')}
                    </div>
                    <div className="text-[#8B949E] text-[10px]">
                      {fmtDur(s.duration_sec)}
                      {s.had_fire ? ' · FIRE' : ''}
                      {s.channels.join('+') ? ` · ${s.channels.join('+')}` : ''}
                    </div>
                    {s.operator_note && (
                      <div className="text-[#6E7681] text-[9px] truncate">{s.operator_note}</div>
                    )}
                    {!s.sealed && laserStatus === 'SAFE' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                        className="text-[#6E7681] hover:text-[#F85149] mt-1"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono text-[#8B949E]">
            <input type="checkbox" checked={filterFire} onChange={(e) => setFilterFire(e.target.checked)} className="accent-[#F85149]" />
            {t('archFilterFire')}
          </label>
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {!liveMode && bundle && hud && (
            <>
              <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[#30363D] bg-[#1C2128]">
                <button type="button" onClick={() => jumpTo(playhead - 5000)} className="p-1 text-[#8B949E]"><SkipBack size={13} /></button>
                <button type="button" onClick={() => setPlaying(!playing)} className="p-1 text-[#58A6FF]">
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button type="button" onClick={() => jumpTo(playhead + 5000)} className="p-1 text-[#8B949E]"><SkipForward size={13} /></button>
                <span className="font-mono text-xs tabular-nums">{fmtClock(playhead)}</span>
                {[0.25, 0.5, 1, 2, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRate(r)}
                    className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono', rate === r ? 'border-[#58A6FF] text-[#58A6FF]' : 'border-[#30363D] text-[#8B949E]')}
                  >
                    {r}×
                  </button>
                ))}
                {bundle.session.channels.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCh(c)}
                    className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold', ch === c ? 'border-[#3FB950] text-[#3FB950]' : 'border-[#30363D] text-[#8B949E]')}
                  >
                    {c}
                  </button>
                ))}
                {bundle.session.channels.includes('IR') && (
                  <button
                    type="button"
                    onClick={() => setIrOn(!irOn)}
                    className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono', irOn ? 'border-[#7ee0c8] text-[#7ee0c8]' : 'border-[#30363D] text-[#8B949E]')}
                  >
                    IR
                  </button>
                )}
                {(['split', 'pip', 'single'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayout(l)}
                    className={cn('px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase', layout === l ? 'border-[#58A6FF] text-[#58A6FF]' : 'border-[#30363D] text-[#8B949E]')}
                  >
                    {l}
                  </button>
                ))}
                <div className="ml-auto flex flex-wrap gap-1">
                  {jumps.map((j) => (
                    <button
                      key={j.label}
                      type="button"
                      onClick={() => jumpTo(j.t)}
                      className="px-1.5 py-0.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#58A6FF] hover:text-[#58A6FF]"
                    >
                      {j.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex-1 min-h-[220px] bg-black">
                <div className="absolute inset-0 flex">
                  <div className={cn('relative', showIr && layout === 'split' ? 'w-full md:w-1/2' : 'w-full')}>
                    <ReplayFeed bundle={bundle} channel={ch} hud={hud} playhead={playhead} className="absolute inset-0 h-full w-full" />
                  </div>
                  {showIr && layout === 'split' && (
                    <div className="relative hidden md:block w-1/2 border-l border-[#30363D]">
                      <ReplayFeed bundle={bundle} channel="IR" hud={hud} playhead={playhead} className="absolute inset-0 h-full w-full" />
                    </div>
                  )}
                </div>
                {showIr && (layout === 'pip' || layout === 'split') && (
                  <div className={cn('absolute bottom-10 right-3 z-20 h-24 w-36 overflow-hidden rounded border border-[#30363D] md:h-28 md:w-44', layout === 'split' && 'md:hidden')}>
                    <ReplayFeed bundle={bundle} channel="IR" hud={hud} playhead={playhead} className="absolute inset-0 h-full w-full" />
                    <span className="absolute left-1 top-1 font-mono text-[9px] text-[#7ee0c8]">IR</span>
                  </div>
                )}
                <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1.5">
                  <span className="rounded border border-[#58A6FF]/50 bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-[#58A6FF]">
                    {t('replayBanner')}
                  </span>
                  <span className={cn(
                    'rounded border px-2 py-0.5 font-mono text-[10px] font-bold',
                    hud.laser === 'FIRING' ? 'border-[#F85149] text-[#F85149]' : hud.laser === 'ARMED' ? 'border-[#D29922] text-[#D29922]' : 'border-[#3FB950]/40 text-[#3FB950]'
                  )}>
                    {hud.laser}
                  </span>
                  {hud.recording && (
                    <span className="flex items-center gap-1 rounded border border-[#F85149]/40 bg-black/70 px-2 py-0.5 font-mono text-[10px] text-[#F85149]">
                      <Circle size={6} fill="currentColor" /> REC
                    </span>
                  )}
                </div>
                <div className="absolute bottom-3 left-3 z-20 rounded border border-[#30363D] bg-black/80 px-2 py-1 font-mono text-[11px]">
                  R {hud.range ? `${(hud.range / 1000).toFixed(2)} km` : '—'} · az {hud.az.toFixed(1)}° / el {hud.el.toFixed(1)}° · Q {hud.quality}%
                  {hud.track === 'COAST' && <span className="ml-2 text-[#F85149]">COAST {hud.coast}s</span>}
                </div>
              </div>

              <div className="px-3 py-2 border-t border-[#30363D] shrink-0">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-[#8B949E]">
                  <span>{t('preroll')} {preroll / 1000}s · REC {fmtClock(recStart)}</span>
                  <span>{fmtClock(maxMono)}</span>
                </div>
                <div
                  ref={barRef}
                  className="relative h-10 cursor-pointer rounded-sm bg-[#0D1117]"
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); onSeek(e.clientX) }}
                  onPointerMove={(e) => { if (e.buttons === 1) onSeek(e.clientX) }}
                >
                  {recStart > 0 && (
                    <div
                      className="absolute inset-y-0 bg-[#58A6FF]/10"
                      style={{
                        left: `${(Math.max(0, recStart - preroll) / maxMono) * 100}%`,
                        width: `${(preroll / maxMono) * 100}%`,
                      }}
                    />
                  )}
                  {bundle.engagements.map((eng) => {
                    const t0 = new Date(eng.started_at).getTime() - new Date(bundle.session.started_at).getTime()
                    const t1 = eng.ended_at
                      ? new Date(eng.ended_at).getTime() - new Date(bundle.session.started_at).getTime()
                      : t0 + eng.duration_sec * 1000
                    return (
                      <div
                        key={eng.id}
                        className="absolute top-1 h-2 rounded-sm bg-[#D29922]/50"
                        style={{ left: `${(t0 / maxMono) * 100}%`, width: `${((t1 - t0) / maxMono) * 100}%` }}
                      />
                    )
                  })}
                  {bundle.events
                    .filter((e) => ['LASER_FIRE_START', 'LASER_ARM', 'TRACK_ACQUIRE', 'TRACK_REACQUIRE', 'CUE_RECEIVED', 'TRACK_LOST'].includes(e.type))
                    .map((e, i) => (
                      <button
                        key={e.id}
                        type="button"
                        title={e.type}
                        onClick={(ev) => { ev.stopPropagation(); jumpTo(e.t_mono_ms) }}
                        className={cn(
                          'absolute flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-sm border bg-[#161B22] font-mono text-[8px] font-bold border-current',
                          eventColor(e.type),
                          i % 2 === 0 ? 'top-3' : 'top-6'
                        )}
                        style={{ left: `${(e.t_mono_ms / maxMono) * 100}%` }}
                      >
                        {eventMarker(e.type)}
                      </button>
                    ))}
                  <div className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-[#E6EDF3]" style={{ left: `${(playhead / maxMono) * 100}%` }}>
                    <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#E6EDF3]" />
                  </div>
                </div>
              </div>
            </>
          )}

          {liveMode && (
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div className="text-[10px] text-[#8B949E] font-mono mb-2">{t('timeline')} · {t('liveLog')}</div>
              {timelineEvents.length === 0 && <div className="text-xs text-[#8B949E] py-6 text-center">{t('noEvents')}</div>}
              {timelineEvents.map((e) => (
                <div key={e.id} className="flex gap-2 text-[11px] font-mono border-b border-[#21262D] py-1.5">
                  <span className="text-[#6E7681] w-[72px]">{e.ts_utc.slice(11, 19)}</span>
                  <span className={cn('w-[120px] font-semibold truncate', eventColor(e.type))}>{e.type}</span>
                  <span className="truncate flex-1">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!liveMode && bundle && (
          <div className="w-full md:w-[19rem] border-t md:border-t-0 md:border-l border-[#30363D] flex flex-col min-h-0 shrink-0">
            <div className="px-3 py-2 border-b border-[#30363D] font-mono text-[10px] tracking-wider text-[#8B949E]">
              {t('archEvents')}
            </div>
            <div className="flex-1 overflow-y-auto max-h-40 md:max-h-none">
              {bundle.events.map((e) => {
                const on = Math.abs(e.t_mono_ms - playhead) < 800
                return (
                  <button
                    key={e.id}
                    type="button"
                    data-active-event={on ? '1' : undefined}
                    onClick={() => jumpTo(e.t_mono_ms)}
                    className={cn('w-full flex gap-2 px-3 py-1.5 text-left font-mono text-[10px] border-b border-[#21262D] hover:bg-[#0D1117]', on && 'bg-[#0D1117]')}
                  >
                    <span className="w-12 shrink-0 text-[#6E7681]">{fmtClock(e.t_mono_ms)}</span>
                    <span className={cn('w-[5.5rem] shrink-0 truncate font-semibold', eventColor(e.type))}>
                      {e.type.replace('LASER_', '')}
                    </span>
                    <span className="truncate">{e.message}</span>
                  </button>
                )
              })}
            </div>
            <div className="p-3 space-y-2 border-t border-[#30363D]">
              {bundle.engagements.map((eng) => (
                <div key={eng.id} className="rounded border border-[#30363D] bg-[#0D1117] p-2 font-mono text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-[#58A6FF]">{eng.id}</span>
                    <span className={eng.result === 'KILL_SOFT' ? 'text-[#3FB950]' : 'text-[#D29922]'}>{eng.result}</span>
                  </div>
                  <div className="mt-0.5">{eng.classification} · {eng.shots_fired} imp · R {eng.range_min_m}–{eng.range_max_m} m</div>
                  <button
                    type="button"
                    className="mt-1 text-[#58A6FF]"
                    onClick={() => {
                      const t0 = new Date(eng.started_at).getTime() - new Date(bundle.session.started_at).getTime()
                      jumpTo(t0)
                    }}
                  >
                    {t('jumpTrack')}
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 text-[10px] text-[#6E7681]">
                <Film size={12} />
                {bundle.media.find((m) => m.kind === 'CLIP')?.label
                  ?? bundle.media.find((m) => m.kind === 'SEGMENT' && (m.label || '').includes('CLIP') || m.label?.includes('ENG'))?.label
                  ?? bundle.media.find((m) => m.kind === 'SNAPSHOT')?.label
                  ?? t('archNoMedia')}
              </div>
              {selectedId && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => downloadText(exportArchiveSessionJson(selectedId), `${selectedId}.json`, 'application/json')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E]"
                  >
                    <Download size={11} /> JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(exportArchiveSessionCsv(selectedId), `${selectedId}.csv`, 'text/csv')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E]"
                  >
                    <Download size={11} /> CSV
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!selectedId || !bundle.engagements[0]) return
                  void (async () => {
                    const url = await exportEngagementClip(selectedId, ch)
                    if (url) {
                      window.open(url, '_blank')
                      return
                    }
                    const clip = {
                      session_id: selectedId,
                      engagement: bundle.engagements[0],
                      window: { t_minus_s: 15, t_plus_s: 25 },
                      events: bundle.events.filter((e) => e.engagement_id === bundle.engagements[0].id).map((e) => e.id),
                      note: sidecarConnected ? 'clip failed' : 'sidecar offline — descriptor only',
                      mediaRoot,
                    }
                    downloadText(JSON.stringify(clip, null, 2), `${bundle.engagements[0].id}_T-15_T+25.json`, 'application/json')
                  })()
                }}
                className="w-full py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#58A6FF] hover:text-[#58A6FF]"
              >
                {t('exportClip')}
              </button>
              <div className="text-[9px] font-mono text-[#6E7681]">
                {archiveMock.getActiveSessionId() ? `active ${archiveMock.getActiveSessionId()}` : 'no live session'}
                {' · '}{recordingActualCodec}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
